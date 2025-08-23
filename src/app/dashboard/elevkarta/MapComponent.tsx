'use client'

import { useEffect, useRef } from 'react'

// Import Leaflet dynamically to avoid SSR issues
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface MapStudent {
  id: string
  fields: {
    NummerID: string
    Namn: string
    Instrument: string
    Födelseår: number
    Status: string
    LärareRecordID?: string | null
    Longitude?: number
    Latitude?: number
    Gata?: string
    Gatunummer?: string
    Ort?: string
    Samtalsanteckningar?: string
  }
}

interface MapComponentProps {
  students: MapStudent[]
  onStudentClick: (student: MapStudent) => void
  selectedStudent: MapStudent | null
}

export default function MapComponent({ students, onStudentClick, selectedStudent }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Initialize map centered on Sweden
    if (!mapRef.current) {
      console.log('Initializing map...')
      mapRef.current = L.map(mapContainerRef.current, {
        // Grundläggande kartinställningar
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        zoomControl: true,
      }).setView([62.0, 15.0], 5) // Sweden coordinates
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current)
      
      // Förhindra kartan från att ta fokus och scrolla sidan
      const container = mapRef.current.getContainer()
      container.style.outline = 'none'
      container.tabIndex = -1 // Gör kartan icke-focusbar via tab
      
      // VIKTIGT: Inaktivera alla automatiska scroll-beteenden
      container.addEventListener('wheel', (e) => {
        e.stopPropagation()
      }, { passive: false })
      
      container.addEventListener('touchmove', (e) => {
        e.stopPropagation()
      }, { passive: false })
      
      console.log('Map initialized:', mapRef.current)
    }

    // Clear existing markers safely
    markersRef.current.forEach(marker => {
      try {
        if (mapRef.current && mapRef.current.hasLayer(marker)) {
          mapRef.current.removeLayer(marker)
        }
      } catch (error) {
        console.warn('Error removing marker:', error)
      }
    })
    markersRef.current = []

    console.log('Adding markers for', students.length, 'students')

    // Add markers for students
    if (mapRef.current) {
      students.forEach((student, index) => {
        console.log(`Processing student ${index}:`, student.fields.NummerID, 'Coords:', student.fields.Latitude, student.fields.Longitude)
        
        if (student.fields.Longitude && student.fields.Latitude) {
          const isSelected = selectedStudent?.id === student.id
          
          // Create custom icon based on instrument and selection
          const getInstrumentIcon = (instrument: string, selected: boolean) => {
            let color = '#6b7280' // gray default
            let icon = '🎵'
            
            // Set color and icon based on instrument
            switch (instrument?.toLowerCase()) {
              case 'piano':
                color = '#3b82f6' // blue
                icon = '🎹'
                break
              case 'gitarr':
              case 'guitar':
                color = '#eab308' // yellow
                icon = '🎸'
                break
              case 'sång':
              case 'vocal':
                color = '#ef4444' // red
                icon = '🎤'
                break
              case 'violin':
                color = '#8b5cf6' // purple
                icon = '🎻'
                break
              case 'trumpet':
                color = '#f97316' // orange
                icon = '🎺'
                break
              case 'trummor':
              case 'drums':
                color = '#10b981' // emerald
                icon = '🥁'
                break
              default:
                color = '#6b7280' // gray
                icon = '🎵'
            }
            
            const size = selected ? 42 : 35
            const borderWidth = selected ? 4 : 3
            const whiteRing = selected ? 'border: 2px solid white; box-shadow: 0 0 0 2px ' + color + ', 0 2px 8px rgba(0,0,0,0.3);' : 'box-shadow: 0 2px 6px rgba(0,0,0,0.3);'
            
            return L.divIcon({
              html: `
                <div style="
                  background-color: ${color};
                  color: white;
                  border-radius: 50%;
                  width: ${size}px;
                  height: ${size}px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-size: ${selected ? '14px' : '10px'};
                  font-weight: bold;
                  cursor: pointer;
                  position: relative;
                  ${whiteRing}
                ">
                  <div style="font-size: ${selected ? '16px' : '12px'}; line-height: 1;">${icon}</div>
                  <div style="font-size: ${selected ? '10px' : '8px'}; line-height: 1; margin-top: 1px;">${student.fields.NummerID}</div>
                </div>
              `,
              className: 'custom-div-icon',
              iconSize: [size, size],
              iconAnchor: [size/2, size/2]
            })
          }

          try {
            const marker = L.marker(
              [student.fields.Latitude, student.fields.Longitude], 
              { icon: getInstrumentIcon(student.fields.Instrument, isSelected) }
            )
            
            if (mapRef.current) {
              marker.addTo(mapRef.current)
              console.log('Marker added successfully for', student.fields.NummerID)
              
              // KRITISK FIX: Förbättrad click handler som förhindrar scroll
              marker.on('click', (e) => {
                // Förhindra alla former av default scroll-beteende
                if (e.originalEvent) {
                  e.originalEvent.preventDefault()
                  e.originalEvent.stopPropagation()
                  e.originalEvent.stopImmediatePropagation()
                }
                
                // Förhindra Leaflet från att panorera kartan
                e.target.closePopup()
                
                // Anropa callback direkt utan fördröjning
                onStudentClick(student)
              })
              
              // Add popup with basic info - INAKTIVERA AUTOPAN för popups
              const calculateAge = (birthYear: number) => {
                const currentYear = new Date().getFullYear()
                return currentYear - birthYear
              }
              
              const popupContent = `
                <div style="min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                    ${student.fields.NummerID}
                  </h3>
                  <p style="margin: 4px 0; font-size: 14px;">
                    <strong>Instrument:</strong> ${student.fields.Instrument || 'Inte angivet'}
                  </p>
                  <p style="margin: 4px 0; font-size: 14px;">
                    <strong>Ålder:</strong> ${student.fields.Födelseår ? calculateAge(student.fields.Födelseår) : 'Okänd'} år
                  </p>
                  ${student.fields.Samtalsanteckningar ? `
                    <p style="margin: 8px 0 4px 0; font-size: 14px;">
                      <strong>Kommentar från vårdnadshavare:</strong>
                    </p>
                    <div style="background-color: #eff6ff; padding: 8px; border-radius: 4px; font-size: 13px; max-height: 100px; overflow-y: auto; border-left: 3px solid #3b82f6;">
                      ${student.fields.Samtalsanteckningar}
                    </div>
                  ` : ''}
                  <button 
                    onclick="window.selectStudentFromMap('${student.id}'); event.stopPropagation(); event.preventDefault();"
                    style="
                      margin-top: 12px;
                      padding: 8px 16px;
                      background-color: #16a34a;
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-size: 12px;
                      font-weight: 500;
                      width: 100%;
                      transition: background-color 0.2s;
                      outline: none;
                    "
                    onmouseover="this.style.backgroundColor='#15803d'"
                    onmouseout="this.style.backgroundColor='#16a34a'"
                  >
                    Visa mer info & ansök om elev
                  </button>
                </div>
              `
              
              marker.bindPopup(popupContent, {
                maxWidth: 250,
                className: 'custom-popup',
                // KRITISKT: Inaktivera alla former av automatisk panorering
                autoPan: false,
                autoPanPadding: [0, 0],
                keepInView: false,
              })
              markersRef.current.push(marker)
            } else {
              console.error('mapRef.current is null when trying to add marker')
            }
          } catch (error) {
            console.error('Error creating marker for student', student.fields.NummerID, ':', error)
          }
        } else {
          console.log('Student has missing coordinates:', student.fields.NummerID)
        }
      })

      // Fit map to show all markers if we have students, but only on initial load
      if (students.length > 0 && markersRef.current.length > 0 && !selectedStudent) {
        try {
          const group = new L.FeatureGroup(markersRef.current)
          // INAKTIVERA AUTOPAN här också
          mapRef.current.fitBounds(group.getBounds().pad(0.1), {
            animate: false, // Ingen animation som kan trigga scroll
          })
        } catch (error) {
          console.warn('Error fitting bounds:', error)
        }
      }
    } else {
      console.error('mapRef.current is null, cannot add markers')
    }

  }, [students, onStudentClick]) // Ta bort selectedStudent från dependency array

  // Separat useEffect för att uppdatera selected marker utan att rita om alla
  useEffect(() => {
    if (selectedStudent && markersRef.current.length > 0) {
      // Uppdatera bara ikoner för alla markörer
      markersRef.current.forEach((marker, index) => {
        const student = students[index]
        if (student) {
          const isSelected = selectedStudent.id === student.id
          
          // Skapa ny ikon
          const getInstrumentIcon = (instrument: string, selected: boolean) => {
            let color = '#6b7280' // gray default
            let icon = '🎵'
            
            switch (instrument?.toLowerCase()) {
              case 'piano':
                color = '#3b82f6' // blue
                icon = '🎹'
                break
              case 'gitarr':
              case 'guitar':
                color = '#eab308' // yellow
                icon = '🎸'
                break
              case 'sång':
              case 'vocal':
                color = '#ef4444' // red
                icon = '🎤'
                break
              case 'violin':
                color = '#8b5cf6' // purple
                icon = '🎻'
                break
              case 'trumpet':
                color = '#f97316' // orange
                icon = '🎺'
                break
              case 'trummor':
              case 'drums':
                color = '#10b981' // emerald
                icon = '🥁'
                break
              default:
                color = '#6b7280' // gray
                icon = '🎵'
            }
            
            const size = selected ? 42 : 35
            const whiteRing = selected ? 'border: 2px solid white; box-shadow: 0 0 0 2px ' + color + ', 0 2px 8px rgba(0,0,0,0.3);' : 'box-shadow: 0 2px 6px rgba(0,0,0,0.3);'
            
            return L.divIcon({
              html: `
                <div style="
                  background-color: ${color};
                  color: white;
                  border-radius: 50%;
                  width: ${size}px;
                  height: ${size}px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-size: ${selected ? '14px' : '10px'};
                  font-weight: bold;
                  cursor: pointer;
                  position: relative;
                  ${whiteRing}
                ">
                  <div style="font-size: ${selected ? '16px' : '12px'}; line-height: 1;">${icon}</div>
                  <div style="font-size: ${selected ? '10px' : '8px'}; line-height: 1; margin-top: 1px;">${student.fields.NummerID}</div>
                </div>
              `,
              className: 'custom-div-icon',
              iconSize: [size, size],
              iconAnchor: [size/2, size/2]
            })
          }
          
          // Uppdatera ikon
          marker.setIcon(getInstrumentIcon(student.fields.Instrument, isSelected))
        }
      })
    }
  }, [selectedStudent, students])

  // Global function for popup button clicks
  useEffect(() => {
    (window as any).selectStudentFromMap = (studentId: string) => {
      const student = students.find(s => s.id === studentId)
      if (student) {
        onStudentClick(student)
      }
    }

    return () => {
      delete (window as any).selectStudentFromMap
    }
  }, [students, onStudentClick])

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-lg overflow-hidden border border-gray-200"
        style={{ 
          minHeight: '500px',
          outline: 'none',
          // KRITISKT: Förhindra scroll-events från att bubbla upp
          overscrollBehavior: 'contain',
          touchAction: 'none'
        }}
        // Lägg till event handlers för att förhindra scroll
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      />
    </div>
  )
}