"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import Image from "next/image"
import {
  geoCentroid,
  geoContains,
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from "d3-geo"
import { Download, House, Minus, Pause, Play, Plus } from "lucide-react"
import { API_BASE_URL, api, type ScanItem } from "@/lib/api"
import { feature as topojsonFeature } from "topojson-client"
import worldTopology from "world-atlas/countries-110m.json"
import statesTopology from "us-atlas/states-10m.json"
import type { FeatureCollection, Geometry } from "geojson"
import type { Topology } from "topojson-specification"

interface CountryProperties {
  name: string
}

const countryFeatures = topojsonFeature(
  worldTopology as unknown as Topology,
  "countries",
) as unknown as FeatureCollection<Geometry, CountryProperties>

const countries = countryFeatures.features
  .filter((country) => country.properties?.name)
  .sort((first, second) => first.properties.name.localeCompare(second.properties.name))
const countryNames = countries.map((country) => country.properties.name)
const states = (topojsonFeature(
  statesTopology as unknown as Topology,
  "states",
) as unknown as FeatureCollection<Geometry, CountryProperties>).features
  .filter((state) => state.properties?.name)
  .sort((first, second) => first.properties.name.localeCompare(second.properties.name))
const stateNames = states.map((state) => state.properties.name)
const placeNames = Array.from(new Set([...countryNames, ...stateNames])).sort((first, second) => first.localeCompare(second))

interface LiveMarker {
  id: string
  location: [number, number]
  label?: string
  type: "danger" | "reference" | "unanalysed"
  scanId?: number
  image?: string
  date?: string
  changeType?: string
}

interface GlobeLiveProps {
  markers?: LiveMarker[]
  className?: string
  speed?: number
}

const markerColors: Record<LiveMarker["type"], string> = {
  danger: "#ff3545",
  reference: "#59e88c",
  unanalysed: "#49c6ee",
}

function downloadCountryChangeReport(countryName: string, markers: LiveMarker[]) {
  const rows = [
    `TerraTrace Change Report - ${countryName}`,
    `Generated: ${new Date().toISOString()}`,
    `${markers.length} analyzed change marker${markers.length === 1 ? "" : "s"} in this country`,
    "",
    ...markers.flatMap((marker, index) => [
      `${index + 1}. ${marker.changeType ?? marker.label ?? "Environmental change detected"}`,
      `   Coordinates: ${marker.location[0].toFixed(5)}, ${marker.location[1].toFixed(5)}`,
      `   Capture date: ${marker.date ? new Date(marker.date).toLocaleDateString() : "Unavailable"}${marker.scanId ? ` | Scan ${marker.scanId}` : ""}`,
      "   Evidence: TerraTrace analyzed scan marker. Review imagery and source scan before making decisions.",
      "",
    ]),
    "Scope: This report includes completed TerraTrace analyses stored in this project. It is not a live satellite feed.",
  ]
  const ascii = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&")
  const chunks: string[][] = []
  for (let i = 0; i < rows.length; i += 44) chunks.push(rows.slice(i, i + 44))
  const objects: string[] = []
  const pageIds = chunks.map((_, index) => 4 + index * 2)
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  chunks.forEach((pageRows, index) => {
    const pageId = pageIds[index]
    const contentId = pageId + 1
    const commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL", ...pageRows.flatMap((line) => [`(${ascii(line)}) Tj`, "T*"]), "ET"].join("\n")
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${new TextEncoder().encode(commands).length} >>\nstream\n${commands}\nendstream`
  })
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = new TextEncoder().encode(pdf).length
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = new TextEncoder().encode(pdf).length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `terratrace-${countryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-change-report.pdf`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function GlobeLive({
  markers: suppliedMarkers,
  className = "",
  speed = 0.00349,
}: GlobeLiveProps) {
  const [databaseMarkers, setDatabaseMarkers] = useState<LiveMarker[]>([])
  const [dataStatus, setDataStatus] = useState<"loading" | "loaded" | "unavailable">("loading")
  const [surveyedLocations, setSurveyedLocations] = useState(0)
  const markers = suppliedMarkers ?? databaseMarkers
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackSphereRef = useRef<HTMLDivElement>(null)
  const projectionRef = useRef<GeoProjection | null>(null)
  const hoveredCountryRef = useRef("")
  const selectedCountryRef = useRef("")
  const pointerInteracting = useRef<{
    x: number
    y: number
  } | null>(null)
  const dragOffset = useRef({
    phi: 0,
    theta: 0,
  })
  const phiOffsetRef = useRef(0)
  const rotationRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const scaleRef = useRef(1)
  const isRotatingRef = useRef(true)
  const draggedRef = useRef(false)
  const [globeScale, setGlobeScale] = useState(1)
  const [isRotating, setIsRotating] = useState(true)
  const [countryQuery, setCountryQuery] = useState("")
  const [hoveredCountry, setHoveredCountry] = useState("")
  const [selectedCountry, setSelectedCountry] = useState("")
  const [selectedMarker, setSelectedMarker] = useState<LiveMarker | null>(null)
  const [countryReportNotice, setCountryReportNotice] = useState("")

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const [locations, scans] = await Promise.all([api.getLocations(), api.getScans()])
        const latestCompletedByLocation = new Map<number, ScanItem>()
        for (const scan of scans) {
          if (scan.status === "completed" && !latestCompletedByLocation.has(scan.location_id)) {
            latestCompletedByLocation.set(scan.location_id, scan)
          }
        }

        const latestResults = await Promise.all(
          [...latestCompletedByLocation.values()].map(async (scan) => ({
            scan,
            result: await api.getAnalysisResults(scan.id).catch(() => null),
          })),
        )
        if (!active) return

        const markersById = new Map<string, LiveMarker>()
        const scanByLocation = new Map([...latestCompletedByLocation.values()].map((scan) => [scan.location_id, scan]))
        const analyzedLocationIds = new Set<number>()
        const detectedLocationIds = new Set<number>()
        for (const { scan, result } of latestResults) {
          if (!result) continue
          analyzedLocationIds.add(scan.location_id)
          if (result.detections.length > 0) detectedLocationIds.add(scan.location_id)
          for (const detection of result.detections) {
            if (!Number.isFinite(detection.centroid_lat) || !Number.isFinite(detection.centroid_lon)) continue
            if (Math.abs(detection.centroid_lat) > 90 || Math.abs(detection.centroid_lon) > 180) continue
            const id = `detection-${detection.id}`
            markersById.set(id, {
              id,
              location: [detection.centroid_lat, detection.centroid_lon],
              label: `${detection.change_type} candidate · scan ${scan.id}`,
              type: "danger",
              scanId: scan.id,
              image: scan.new_thumbnail,
              date: scan.scan_date_new || scan.completed_at || scan.created_at,
              changeType: detection.change_type,
            })
          }
        }

        for (const location of locations) {
          if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) continue
          const hasAnalysis = analyzedLocationIds.has(location.id)
          const hasDetections = detectedLocationIds.has(location.id)
          if (hasDetections) continue
          markersById.set(`location-${location.id}`, {
            id: `location-${location.id}`,
            location: [location.latitude, location.longitude],
            label: location.name,
            type: hasAnalysis ? "reference" : "unanalysed",
            scanId: scanByLocation.get(location.id)?.id,
            image: scanByLocation.get(location.id)?.new_thumbnail,
            date: scanByLocation.get(location.id)?.scan_date_new || scanByLocation.get(location.id)?.completed_at,
          })
        }

        setSurveyedLocations(locations.length)
        setDatabaseMarkers([...markersById.values()])
        setDataStatus("loaded")
      } catch {
        if (active) setDataStatus("unavailable")
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    scaleRef.current = globeScale
  }, [globeScale])

  useEffect(() => {
    isRotatingRef.current = isRotating
  }, [isRotating])

  useEffect(() => {
    hoveredCountryRef.current = hoveredCountry
  }, [hoveredCountry])

  useEffect(() => {
    selectedCountryRef.current = selectedCountry
  }, [selectedCountry])
  /*
   * Mouse / touch interaction
   */
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      pointerInteracting.current = {
        x: event.clientX,
        y: event.clientY,
      }
      draggedRef.current = false
      isPausedRef.current = true
      if (canvasRef.current) {
        canvasRef.current.style.cursor = "grabbing"
      }
    },
    [],
  )

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = {
        phi: 0,
        theta: 0,
      }
    }
    pointerInteracting.current = null
    isPausedRef.current = false
    if (canvasRef.current) {
      canvasRef.current.style.cursor = "grab"
    }
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    setGlobeScale((scale) => Math.min(1.55, Math.max(0.75, Number((scale + (event.deltaY < 0 ? 0.08 : -0.08)).toFixed(2)))))
  }, [])

  const resetGlobe = () => {
    phiOffsetRef.current = 0
    rotationRef.current = 0
    thetaOffsetRef.current = 0
    dragOffset.current = { phi: 0, theta: 0 }
    pointerInteracting.current = null
    scaleRef.current = 1
    isRotatingRef.current = false
    setGlobeScale(1)
    setIsRotating(false)
    setCountryQuery("")
    setSelectedCountry("")
  }

  const focusCountry = (name: string) => {
    const country = countries.find((feature) => feature.properties.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    const state = states.find((feature) => feature.properties.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    const feature = country ?? state
    if (!feature) return
    const [longitude, latitude] = geoCentroid(feature)
    rotationRef.current = 0
    phiOffsetRef.current = longitude * Math.PI / 180
    thetaOffsetRef.current = latitude * Math.PI / 180
    dragOffset.current = { phi: 0, theta: 0 }
    setSelectedCountry(feature.properties.name)
    setCountryQuery(feature.properties.name)
  }

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (pointerInteracting.current) {
        const deltaX = event.clientX - pointerInteracting.current.x
        const deltaY = event.clientY - pointerInteracting.current.y
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) draggedRef.current = true
        dragOffset.current = {
          phi: deltaX / 350,
          theta: deltaY / 1000,
        }
        return
      }

      const canvas = canvasRef.current
      const projection = projectionRef.current
      if (!canvas || !projection) return
      const bounds = canvas.getBoundingClientRect()
      const location = projection.invert?.([event.clientX - bounds.left, event.clientY - bounds.top])
      if (!location) return
      const state = states.find((feature) => geoContains(feature, location))
      const country = countries.find((feature) => geoContains(feature, location))
      const name = state?.properties.name ?? country?.properties.name ?? ""
      setHoveredCountry((current) => current === name ? current : name)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  // Draw country geometry and labels into an orthographic projection each frame.
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return
    let animationFrame = 0
    let lastFrame = performance.now()
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const graticule = geoGraticule10()

    const render = (now: number) => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) {
        animationFrame = requestAnimationFrame(render)
        return
      }
      if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
        canvas.width = Math.round(width * pixelRatio)
        canvas.height = Math.round(height * pixelRatio)
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)

      const elapsed = Math.min(now - lastFrame, 50)
      lastFrame = now
      if (!reduceMotion && !isPausedRef.current && isRotatingRef.current) {
        rotationRef.current += speed * elapsed / (1000 / 60)
      }

      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.445 * scaleRef.current
      const projection = geoOrthographic()
        .translate([centerX, centerY])
        .scale(radius)
        .clipAngle(90)
        .precision(0.35)
        .rotate([
          -(rotationRef.current + phiOffsetRef.current + dragOffset.current.phi) * 180 / Math.PI,
          -(thetaOffsetRef.current + dragOffset.current.theta) * 180 / Math.PI,
        ])
      projectionRef.current = projection
      const path = geoPath(projection, context)

      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      const ocean = context.createRadialGradient(centerX - radius * 0.32, centerY - radius * 0.4, radius * 0.06, centerX, centerY, radius)
      ocean.addColorStop(0, "#287eb1")
      ocean.addColorStop(0.68, "#155582")
      ocean.addColorStop(1, "#081c36")
      context.fillStyle = ocean
      context.fill()
      context.save()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      context.clip()

      context.beginPath()
      path(graticule)
      context.strokeStyle = "rgba(180, 224, 245, 0.21)"
      context.lineWidth = 0.45
      context.stroke()

      const selectedName = selectedCountryRef.current
      const hoveredName = hoveredCountryRef.current
      const selectedFeature = countries.find((country) => country.properties.name === selectedName)
      for (const country of countries) {
        context.beginPath()
        path(country)
        context.fillStyle = country === selectedFeature
          ? "#ef9f43"
          : country.properties.name === hoveredName
            ? "#72c98b"
            : "#318653"
        context.strokeStyle = "rgba(7, 34, 42, 0.95)"
        context.lineWidth = Math.max(0.45, width / 900)
        context.fill()
        context.stroke()
      }

      for (const state of states) {
        context.beginPath()
        path(state)
        context.fillStyle = state.properties.name === selectedName
          ? "#ef9f43"
          : state.properties.name === hoveredName
            ? "#72c98b"
            : "rgba(49, 134, 83, 0.94)"
        context.strokeStyle = "rgba(9, 38, 47, 0.96)"
        context.lineWidth = Math.max(0.55, width / 700)
        context.fill()
        context.stroke()
      }

      const visibleCenter = projection.invert?.([centerX, centerY])
      if (visibleCenter) {
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.font = `500 ${Math.max(6, Math.min(8, width / 64))}px system-ui, sans-serif`
        context.lineJoin = "round"
        const activeCountryName = hoveredName || selectedName
        const activePlace = countries.find((country) => country.properties.name === activeCountryName)
          ?? states.find((state) => state.properties.name === activeCountryName)
        if (activePlace) {
          const centroid = geoCentroid(activePlace)
          if (geoDistance(visibleCenter, centroid) <= Math.PI / 2 - 0.02) {
            const point = projection(centroid)
            if (point) {
              const name = activePlace.properties.name
              context.font = `600 ${Math.max(9, Math.min(13, width / 48))}px system-ui, sans-serif`
              context.lineWidth = 4
              context.strokeStyle = "rgba(5, 22, 31, 0.96)"
              context.strokeText(name, point[0], point[1], Math.max(64, radius * 0.72))
              context.fillStyle = name === selectedName ? "#fff0d6" : "#ffffff"
              context.fillText(name, point[0], point[1], Math.max(64, radius * 0.72))
            }
          }
        }

        for (const marker of markers) {
          if (geoDistance(visibleCenter, [marker.location[1], marker.location[0]]) > Math.PI / 2 - 0.02) continue
          const point = projection([marker.location[1], marker.location[0]])
          if (!point) continue
          const color = markerColors[marker.type]
          context.beginPath()
          if (marker.type === "danger") {
            context.setLineDash([1.5, 2.5])
            context.arc(point[0], point[1], Math.max(5, radius * 0.025), 0, Math.PI * 2)
            context.strokeStyle = color
            context.lineWidth = 1.25
            context.stroke()
            context.setLineDash([])
          }
          context.beginPath()
          context.arc(point[0], point[1], marker.type === "danger" ? 2.3 : 2.6, 0, Math.PI * 2)
          context.fillStyle = color
          context.shadowColor = color
          context.shadowBlur = 7
          context.fill()
          context.shadowBlur = 0
        }
      }

      context.restore()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      context.strokeStyle = "rgba(144, 218, 244, 0.75)"
      context.lineWidth = 1.2
      context.stroke()

      canvas.style.opacity = "1"
      if (fallbackSphereRef.current) fallbackSphereRef.current.style.opacity = "0"
      animationFrame = requestAnimationFrame(render)
    }

    animationFrame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrame)
  }, [markers, speed])

  const countryAtPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggedRef.current) return
    const projection = projectionRef.current
    if (!projection) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const screenPoint: [number, number] = [event.clientX - bounds.left, event.clientY - bounds.top]
    let closest: { marker: LiveMarker; distance: number } | null = null
    for (const marker of markers) {
      if (geoDistance([0, 0], [marker.location[1], marker.location[0]]) > Math.PI / 2 - 0.02) continue
      const projected = projection([marker.location[1], marker.location[0]])
      if (!projected) continue
      const distance = Math.hypot(projected[0] - screenPoint[0], projected[1] - screenPoint[1])
      if (distance < 18 && (!closest || distance < closest.distance)) closest = { marker, distance }
    }
    if (closest) {
      setSelectedMarker(closest.marker)
      return
    }
    setSelectedMarker(null)
    const point = projection.invert?.(screenPoint)
    if (!point) return
          const state = states.find((feature) => geoContains(feature, point))
            const country = countries.find((feature) => geoContains(feature, point))
    const feature = country ?? state
    if (feature) {
      focusCountry(feature.properties.name)
      if (countries.some((country) => country.properties.name === feature.properties.name)) {
        const country = countries.find((item) => item.properties.name === feature.properties.name)
        const countryMarkers = country ? markers.filter((marker) => marker.type === "danger" && geoContains(country, [marker.location[1], marker.location[0]])) : []
        if (countryMarkers.length) {
          downloadCountryChangeReport(feature.properties.name, countryMarkers)
          setCountryReportNotice(`Downloaded PDF with ${countryMarkers.length} analyzed change marker${countryMarkers.length === 1 ? "" : "s"} for ${feature.properties.name}.`)
        } else {
          setCountryReportNotice(`No analyzed red change markers are recorded for ${feature.properties.name}.`)
        }
      }
    }
  }

  return (
    <div
      className={`
        relative
        aspect-square
        w-full
        select-none
        overflow-visible
        ${className}
      `}
    >
      {/* ================================================= */}
      {/* BACKGROUND GLOW */}
      {/* ================================================= */}
      <div
        className="
          pointer-events-none
          absolute
          inset-[10%]
          rounded-full
          bg-cyan-400/10
          blur-[70px]
        "
      />
      <div
        className="
          pointer-events-none
          absolute
          inset-[18%]
          rounded-full
          bg-emerald-400/5
          blur-[45px]
        "
      />

      {/* ================================================= */}
      {/* HUD OUTER RING */}
      {/* ================================================= */}
      <div
        className="
          pointer-events-none
          absolute
          inset-[4%]
          rounded-full
          border
          border-cyan-400/10
        "
      />
      <div
        className="
          pointer-events-none
          absolute
          inset-[7%]
          rounded-full
          border
          border-dashed
          border-cyan-400/10
          animate-spin
        "
        style={{
          animationDuration: "35s",
        }}
      />

      {/* ================================================= */}
      {/* ROTATING HUD MARKERS */}
      {/* ================================================= */}
      <div
        className="
          pointer-events-none
          absolute
          left-[4%]
          top-[22%]
          h-3
          w-3
          rounded-full
          border
          border-cyan-300
          bg-cyan-400/20
          shadow-[0_0_18px_rgba(38,198,255,0.8)]
        "
      />
      <div
        className="
          pointer-events-none
          absolute
          right-[5%]
          bottom-[25%]
          h-2
          w-2
          rounded-full
          bg-emerald-400
          shadow-[0_0_15px_rgba(50,245,160,0.9)]
        "
      />

      {/* ================================================= */}
      {/* LIVE STATUS */}
      {/* ================================================= */}
      <div
        className="
          absolute
          left-1/2
          top-[3%]
          z-20
          -translate-x-1/2
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
            rounded-full
            border
            border-cyan-400/20
            bg-[#06151d]/80
            px-3
            py-1.5
            shadow-[0_0_25px_rgba(38,198,255,0.12)]
            backdrop-blur-xl
          "
        >
          <span
            className="
              h-1.5
              w-1.5
              animate-pulse
              rounded-full
              bg-emerald-400
              shadow-[0_0_10px_#32F5A0]
            "
          />
          <span
            className="
              font-mono
              text-[9px]
              font-semibold
              tracking-[0.2em]
              text-cyan-300
            "
          >
            {dataStatus === "loading"
              ? "LOADING DATABASE LOCATIONS"
              : dataStatus === "unavailable"
                ? "BACKEND UNAVAILABLE · NO LIVE FEED"
                : `DATABASE LOCATIONS · ${surveyedLocations} MONITORED`}
          </span>
        </div>
      </div>

      <label className="absolute left-[5%] top-[13%] z-30 flex max-w-[48%] flex-col gap-1 text-[9px] font-mono text-cyan-100">
        <span>FIND A COUNTRY OR U.S. STATE · {countries.length} COUNTRIES</span>
        <input
          list="terratrace-country-options"
          value={countryQuery}
          onChange={(event) => {
            setCountryQuery(event.target.value)
            const exact = [...countries, ...states].find((place) => place.properties.name.toLocaleLowerCase() === event.target.value.trim().toLocaleLowerCase())
            if (exact) focusCountry(exact.properties.name)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            const match = [...countries, ...states].find((place) => place.properties.name.toLocaleLowerCase().startsWith(countryQuery.trim().toLocaleLowerCase()))
            if (match) focusCountry(match.properties.name)
          }}
          placeholder="Type a country name"
          aria-label="Find and focus a country on the globe"
          className="h-8 w-36 max-w-full rounded border border-cyan-100/25 bg-[#071923]/90 px-2 text-[10px] text-white outline-none placeholder:text-slate-400 focus:border-cyan-200 sm:w-44"
        />
        <datalist id="terratrace-country-options">
          {placeNames.map((name, i) => <option key={`${name}-${i}`} value={name} />)}
        </datalist>
      </label>

      <div
        ref={fallbackSphereRef}
        aria-hidden="true"
          className="pointer-events-none absolute inset-[10%] overflow-hidden rounded-full border border-cyan-100/20 transition-opacity duration-700"
        style={{
          backgroundImage: "radial-gradient(circle at 34% 30%, #1979b7 0%, #0b315d 72%)",
          boxShadow: "inset -30px -8px 58px rgba(0, 5, 18, 0.68), inset 8px 0 28px rgba(36, 151, 255, 0.24), 0 0 48px rgba(38, 132, 255, 0.2)",
        }}
      >
        <div
          className="globe-texture-turn absolute inset-y-0 left-0 w-[200%]"
          style={{
            backgroundImage: "radial-gradient(ellipse at 18% 30%, rgba(80, 210, 125, 0.96) 0 7%, transparent 7.8%), radial-gradient(ellipse at 26% 38%, rgba(105, 220, 125, 0.98) 0 11%, transparent 11.8%), radial-gradient(ellipse at 31% 57%, rgba(45, 165, 105, 0.96) 0 8%, transparent 8.8%), radial-gradient(ellipse at 20% 70%, rgba(70, 190, 112, 0.9) 0 6%, transparent 6.8%), radial-gradient(ellipse at 69% 32%, rgba(80, 210, 125, 0.94) 0 8%, transparent 8.8%), radial-gradient(ellipse at 78% 45%, rgba(105, 220, 125, 0.95) 0 12%, transparent 12.8%), radial-gradient(ellipse at 71% 67%, rgba(45, 165, 105, 0.92) 0 8%, transparent 8.8%)",
            backgroundSize: "50% 100%",
            backgroundRepeat: "repeat-x",
          }}
        />
        <div className="absolute inset-[13%] rounded-full border-x border-cyan-100/15" />
        <div className="absolute inset-x-0 top-1/2 border-t border-cyan-100/10" />
        <div className="absolute inset-x-[7%] top-[34%] rounded-[50%] border-t border-cyan-100/10" />
        <div className="absolute inset-x-[7%] bottom-[34%] rounded-[50%] border-t border-cyan-100/10" />
      </div>

      {/* Rotating WebGL globe */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => {
          if (pointerInteracting.current) return
          const projection = projectionRef.current
          if (!projection) return
          const bounds = event.currentTarget.getBoundingClientRect()
          const point = projection.invert?.([event.clientX - bounds.left, event.clientY - bounds.top])
          if (!point) return
          const country = countries.find((feature) => geoContains(feature, point))
          const name = country?.properties.name ?? ""
          setHoveredCountry((current) => current === name ? current : name)
        }}
        onPointerLeave={() => { handlePointerUp(); setHoveredCountry("") }}
        onPointerCancel={handlePointerUp}
        onClick={countryAtPointer}
        onWheel={handleWheel}
        onDoubleClick={() => setGlobeScale((scale) => scale > 1 ? 1 : 1.35)}
        role="img"
        aria-label={`Orthographic globe showing ${countries.length} countries with real borders and U.S. state boundaries; ${hoveredCountry || selectedCountry || "hover or select a country or state to see its name"}; ${isRotating ? "rotation enabled" : "paused"}, zoom ${globeScale.toFixed(2)}x`}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          touchAction: "none",
          display: "block",
        }}
      />

      {selectedMarker && (
        <div className="absolute left-1/2 top-1/2 z-40 w-64 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/15 bg-[#071923]/95 text-left shadow-2xl backdrop-blur-xl">
          <button type="button" onClick={() => setSelectedMarker(null)} aria-label="Close scan preview" className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white">Close</button>
          {selectedMarker.image ? <Image src={`${API_BASE_URL}${selectedMarker.image}`} alt="Latest image for this monitoring point" width={512} height={256} unoptimized className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-emerald-950/60 text-sm text-slate-300">No scan image available</div>}
          <div className="space-y-1 p-3">
            <p className="text-sm font-semibold text-white">{selectedMarker.changeType ?? selectedMarker.label ?? "Monitoring point"}</p>
            <p className="text-xs text-slate-400">{selectedMarker.date ? new Date(selectedMarker.date).toLocaleDateString() : "Date unavailable"}{selectedMarker.scanId ? ` · Scan ${selectedMarker.scanId}` : ""}</p>
            {selectedMarker.scanId && <a href={`/analyze?scan_id=${selectedMarker.scanId}`} className="mt-2 inline-flex min-h-9 items-center text-xs font-medium text-emerald-300 hover:text-white">Open comparison →</a>}
          </div>
        </div>
      )}

      {countryReportNotice && (
        <div role="status" className="absolute left-1/2 top-[19%] z-40 flex max-w-[82%] -translate-x-1/2 items-center gap-2 rounded-lg border border-cyan-200/25 bg-[#071923]/95 px-3 py-2 text-[10px] text-cyan-50 shadow-xl backdrop-blur-xl">
          <Download className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <span>{countryReportNotice}</span>
          <button type="button" onClick={() => setCountryReportNotice("")} aria-label="Dismiss report status" className="ml-1 text-slate-400 hover:text-white">×</button>
        </div>
      )}

      <div className="absolute right-[5%] top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          onClick={() => setGlobeScale((scale) => Math.min(1.55, Number((scale + 0.15).toFixed(2))))}
          disabled={globeScale >= 1.55}
          aria-label="Zoom in on globe"
          title="Zoom in"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-100/20 bg-[#071923]/85 text-white backdrop-blur transition-colors hover:border-cyan-200/50 hover:bg-[#0c2937] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setGlobeScale((scale) => Math.max(0.75, Number((scale - 0.15).toFixed(2))))}
          disabled={globeScale <= 0.75}
          aria-label="Zoom out on globe"
          title="Zoom out"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-100/20 bg-[#071923]/85 text-white backdrop-blur transition-colors hover:border-cyan-200/50 hover:bg-[#0c2937] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsRotating((rotating) => !rotating)}
          aria-label={isRotating ? "Pause globe rotation" : "Resume globe rotation"}
          title={isRotating ? "Pause rotation" : "Resume rotation"}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-100/20 bg-[#071923]/85 text-white backdrop-blur transition-colors hover:border-cyan-200/50 hover:bg-[#0c2937] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
        >
          {isRotating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={resetGlobe}
          aria-label="Reset globe view and stop rotation"
          title="Reset view"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-100/20 bg-[#071923]/85 text-white backdrop-blur transition-colors hover:border-cyan-200/50 hover:bg-[#0c2937] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
        >
          <House className="h-4 w-4" />
        </button>
      </div>

      <div
        className="absolute bottom-[3%] left-1/2 z-20 flex max-w-[94%] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-cyan-400/20 bg-[#06151d]/90 px-3 py-2 text-center backdrop-blur-xl"
      >
        <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-200"><span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />Change detected in latest analysis</span>
        <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-200"><span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />Latest analysis: no detections</span>
        <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-200"><span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />No completed analysis</span>
        <span className="basis-full text-[8px] leading-tight text-slate-300 sm:text-[9px]">Database scan records · not live global satellite coverage · select a place to center it</span>
      </div>

    </div>
  )
}
