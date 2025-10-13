'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Dynamically import map to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-gray-600">Laddar karta...</p>
    </div>
  </div>
})

interface Student {
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
    Önskar?: string[]
  }
}

export default function ElevkartaPage() {
  const { data: session } = useSession()
  
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [wishForm, setWishForm] = useState({
    nummerID: '',
    kommentar: '',
    loading: false
  })
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [geocodingProgress, setGeocodingProgress] = useState<{ current: number, total: number } | null>(null)

  useEffect(() => {
    if (session?.user?.teacherId) {
      fetchAvailableStudents()
    }
  }, [session])

  // Function to validate if coordinates are reasonable for Sweden
  const isValidSwedishCoordinates = (lat: number, lng: number): boolean => {
    // Sweden bounding box (approximate)
    const swedenBounds = {
      north: 69.1,
      south: 55.3,
      east: 24.2,
      west: 10.9
    }
    
    return lat >= swedenBounds.south && lat <= swedenBounds.north && 
           lng >= swedenBounds.west && lng <= swedenBounds.east
  }

  // Function to clean and format address for geocoding
  const formatAddressForGeocoding = (gata: any, gatunummer: any, ort: any): string => {
    let address = ''
    
    // Combine street and number
    if (gata && typeof gata === 'string') {
      address = gata.trim()
      if (gatunummer) {
        // Remove any postal codes from gatunummer field
        const cleanGatunummer = gatunummer.toString().replace(/\d{5,}/g, '').trim()
        if (cleanGatunummer) {
          address += ` ${cleanGatunummer}`
        }
      }
    } else if (gata) {
      // If gata is not a string, convert it
      address = gata.toString().trim()
      if (gatunummer) {
        const cleanGatunummer = gatunummer.toString().replace(/\d{5,}/g, '').trim()
        if (cleanGatunummer) {
          address += ` ${cleanGatunummer}`
        }
      }
    }
    
    // Add city (remove any postal codes)
    if (ort) {
      const cleanOrt = ort.toString().trim().replace(/^\d{5}\s*/, '') // Remove postal code from beginning
      if (address) {
        address += `, ${cleanOrt}`
      } else {
        address = cleanOrt
      }
    }
    
    return address.trim()
  }

  // Function to geocode an address using a free geocoding service
  const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
    try {
      // Using Nominatim (OpenStreetMap's geocoding service) - free and no API key required
      const query = encodeURIComponent(`${address}, Sweden`)
      console.log(`Geocoding query: ${query}`)
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=se`)
      
      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        
        if (isValidSwedishCoordinates(lat, lng)) {
          console.log(`Successfully geocoded: ${address} -> ${lat}, ${lng}`)
          return { lat, lng }
        } else {
          console.warn('Geocoded coordinates outside Sweden bounds:', { lat, lng, address })
          return null
        }
      } else {
        console.warn(`No geocoding results for: ${address}`)
        return null
      }
      
    } catch (error) {
      console.error('Geocoding error:', error)
      return null
    }
  }

  // Function to update guardian coordinates (since Longitude/Latitude are in the guardian table)
  const updateGuardianCoordinates = async (guardianId: string, lat: number, lng: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/guardians/${guardianId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Latitude': lat.toString(),
            'Longitude': lng.toString()
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Airtable update error:', errorData)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating guardian coordinates:', error)
      return false
    }
  }

  // Function to mark guardian as geocoding failed
  const markGuardianGeocodingFailed = async (guardianId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/guardians/${guardianId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Latitude': 'fel',
            'Longitude': 'fel'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Airtable update error:', errorData)
        return false
      }

      return true
    } catch (error) {
      console.error('Error marking geocoding failed:', error)
      return false
    }
  }

  const fetchAvailableStudents = async () => {
    try {
      setLoading(true)
      
      const studentsResponse = await fetch('/api/students?scope=available')

      if (!studentsResponse.ok) {
        throw new Error('Error fetching students')
      }

      const studentsData = await studentsResponse.json()
      const allRecords = studentsData.records || []

      const guardiansResponse = await fetch('/api/guardians')

      if (!guardiansResponse.ok) {
        throw new Error('Error fetching guardians')
      }

      const guardiansData = await guardiansResponse.json()
      const allGuardians = guardiansData.records || []
      
      // Skapa en map för vårdnadshavare
      const guardiansMap = new Map()
      allGuardians.forEach(guardian => {
        guardiansMap.set(guardian.id, guardian.fields)
      })
      
      // Filtrera tillgängliga elever
      const potentialStudents = allRecords
        .filter((record: any) => {
          const isActive = record.fields.Status === 'Aktiv'
          const hasNoTeacher = !record.fields.LärareRecordID
          return isActive && hasNoTeacher
        })
        .map((record: any) => {
          // Lägg till vårdnadshavardata
          const guardianId = Array.isArray(record.fields.Vårdnadshavare) 
            ? record.fields.Vårdnadshavare[0] 
            : record.fields.Vårdnadshavare
          
          const guardianData = guardiansMap.get(guardianId) || {}
          
          return {
            ...record,
            guardianId: guardianId, // Lägg till guardian ID för senare uppdateringar
            fields: {
              ...record.fields,
              // Använd lookup-fältet först, sedan fallback till direkt hämtning
              Samtalsanteckningar: record.fields.Samtalsanteckningar || guardianData.Samtalsanteckning || '',
              // Hämta adress direkt från vårdnadshavare (inte lookup fields)
              Gata: guardianData.Gata,
              Gatunummer: guardianData.Gatunummer,
              Ort: guardianData.Ort,
              // Koordinater kommer från vårdnadshavare
              Longitude: guardianData.Longitude,
              Latitude: guardianData.Latitude,
            }
          }
        })
        .filter((record: any) => {
          // Endast inkludera elever som har en vårdnadshavare med adressdata
          return record.guardianId && record.fields.Gata && record.fields.Ort
        })

      console.log('Potential students found:', potentialStudents.length)

      // Nu behöver vi geocoda de som saknar korrekta koordinater
      const studentsNeedingGeocoding = potentialStudents.filter((student: any) => {
        const lat = parseFloat(student.fields.Latitude)
        const lng = parseFloat(student.fields.Longitude)
        
        // Kontrollera om koordinaterna är ogiltiga eller ej svenska
        const hasValidCoordinates = !isNaN(lat) && !isNaN(lng) && 
                                   student.fields.Latitude !== 'error' && 
                                   student.fields.Longitude !== 'error' &&
                                   student.fields.Latitude !== 'fel' && 
                                   student.fields.Longitude !== 'fel' &&
                                   isValidSwedishCoordinates(lat, lng)
        
        const hasAddress = student.fields.Gata && student.fields.Ort
        
        // Skippa de som har "fel" markering
        const isFailed = student.fields.Latitude === 'fel' || student.fields.Longitude === 'fel'
        
        return !hasValidCoordinates && hasAddress && !isFailed
      })

      console.log('Students needing geocoding:', studentsNeedingGeocoding.length)

      // Geocoda de som behöver det
      if (studentsNeedingGeocoding.length > 0) {
        setGeocodingProgress({ current: 0, total: studentsNeedingGeocoding.length })
        
        for (let i = 0; i < studentsNeedingGeocoding.length; i++) {
          const student = studentsNeedingGeocoding[i]
          setGeocodingProgress({ current: i + 1, total: studentsNeedingGeocoding.length })
          
          // Debug: Log the raw address data
          console.log(`Student ${student.fields.NummerID} address data:`, {
            Gata: student.fields.Gata,
            GataType: typeof student.fields.Gata,
            Gatunummer: student.fields.Gatunummer,
            GatunummerType: typeof student.fields.Gatunummer,
            Ort: student.fields.Ort,
            OrtType: typeof student.fields.Ort
          })
          
          const address = formatAddressForGeocoding(student.fields.Gata, student.fields.Gatunummer, student.fields.Ort)
          console.log(`Geocoding ${i + 1}/${studentsNeedingGeocoding.length}: ${student.fields.NummerID} - "${address}"`)
          
          // Skip if address is empty or too short
          if (!address || address.length < 3) {
            console.warn(`Skipping ${student.fields.NummerID}: Address too short or empty`)
            continue
          }
          
          const coordinates = await geocodeAddress(address)
          
          if (coordinates) {
            // Uppdatera i Vårdnadshavartabellen
            const success = await updateGuardianCoordinates(student.guardianId, coordinates.lat, coordinates.lng)
            if (success) {
              // Uppdatera lokal data
              student.fields.Latitude = coordinates.lat
              student.fields.Longitude = coordinates.lng
              console.log(`Successfully geocoded ${student.fields.NummerID}`)
            } else {
              console.error(`Failed to update coordinates for ${student.fields.NummerID}`)
            }
          } else {
            // Markera som "fel" i Airtable så vi inte försöker igen
            console.warn(`Failed to geocode ${student.fields.NummerID}: ${address} - marking as failed`)
            await markGuardianGeocodingFailed(student.guardianId)
          }
          
          // Vänta lite mellan requests för att inte överbelasta geocoding-tjänsten
          if (i < studentsNeedingGeocoding.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        setGeocodingProgress(null)
      }

      // Filtrera slutliga elever med giltiga koordinater
      const studentsWithValidCoordinates = potentialStudents.filter((student: any) => {
        const lat = parseFloat(student.fields.Latitude)
        const lng = parseFloat(student.fields.Longitude)
        
        return !isNaN(lat) && !isNaN(lng) && 
               student.fields.Latitude !== 'error' && 
               student.fields.Longitude !== 'error' &&
               student.fields.Latitude !== 'fel' && 
               student.fields.Longitude !== 'fel' &&
               isValidSwedishCoordinates(lat, lng)
      })
      
      console.log('Students with valid coordinates:', studentsWithValidCoordinates.length)
      setAvailableStudents(studentsWithValidCoordinates)
      
    } catch (error) {
      console.error('Error fetching students:', error)
      setStatusMessage({ type: 'error', message: 'Fel vid hämtning av elevdata' })
    } finally {
      setLoading(false)
    }
  }

  const calculateAge = (birthYear: number) => {
    const currentYear = new Date().getFullYear()
    return currentYear - birthYear
  }

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student)
    setWishForm(prev => ({ ...prev, nummerID: student.fields.NummerID }))
  }

  const submitWish = async () => {
    if (!selectedStudent) {
      setStatusMessage({ type: 'error', message: 'Ingen elev vald' })
      return
    }

    try {
      setWishForm(prev => ({ ...prev, loading: true }))
      
      // Hämta nuvarande "Önskar" för eleven
      const currentWishes = selectedStudent.fields.Önskar || []
      
      // Lägg till vår lärare om hen inte redan finns
      const teacherId = session?.user?.teacherId
      if (!teacherId) {
        setStatusMessage({ type: 'error', message: 'Kunde inte hitta ditt lärar-ID' })
        return
      }
      
      // Kontrollera om läraren redan har ansökt
      if (currentWishes.includes(teacherId)) {
        setStatusMessage({ type: 'error', message: 'Du har redan ansökt om denna elev' })
        setWishForm(prev => ({ ...prev, loading: false }))
        return
      }
      
      const updatedWishes = [...currentWishes, teacherId]
      
      const response = await fetch(`/api/students/${selectedStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Önskar': updatedWishes
          }
        })
      })

      if (response.ok) {
        setStatusMessage({ type: 'success', message: `Du har ansökt om att undervisa elev ${selectedStudent.fields.NummerID}!` })
        setWishForm({ nummerID: '', kommentar: '', loading: false })
        setSelectedStudent(null)
        // Refresh data
        await fetchAvailableStudents()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error updating student:', errorData)
        setStatusMessage({ type: 'error', message: 'Kunde inte skicka ansökan' })
      }
    } catch (error) {
      console.error('Error submitting wish:', error)
      setStatusMessage({ type: 'error', message: 'Fel vid skickande av ansökan' })
    } finally {
      setWishForm(prev => ({ ...prev, loading: false }))
    }
  }

  // Auto-hide status messages after 5 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  if (loading || geocodingProgress) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          {geocodingProgress ? (
            <div>
              <span className="text-gray-600">Geocodar adresser...</span>
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2 w-64 mx-auto">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(geocodingProgress.current / geocodingProgress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {geocodingProgress.current} av {geocodingProgress.total} elever
                </p>
              </div>
            </div>
          ) : (
            <span className="text-gray-600">Laddar elevkarta...</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Status Messages */}
      {statusMessage && (
        <div className={`rounded-lg p-4 ${
          statusMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            <span className="mr-2">
              {statusMessage.type === 'success' ? '✅' : '❌'}
            </span>
            {statusMessage.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Elevkarta</h1>
        <p className="text-gray-600 mb-4">
          Klicka på en elev på kartan för att se mer information och ansöka om att undervisa. 
          Kartan visar alla aktiva elever som inte har en lärare tilldelad än.
        </p>
        <p className="text-sm text-gray-500">
          Tillgängliga elever: <strong>{availableStudents.length}</strong>
        </p>
        
        {availableStudents.length === 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-yellow-600 mr-2">⚠️</span>
              <span className="text-yellow-800">
                Inga tillgängliga elever med korrekta adresser hittades. 
                Kontrollera att eleverna har korrekta adresser i systemet.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Karta */}
      {availableStudents.length > 0 && (
        <div className="relative z-0 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Interaktiv karta</h2>
          <div className="h-[500px] rounded-lg overflow-hidden">
            <MapComponent
              students={availableStudents}
              onStudentClick={handleStudentClick}
              selectedStudent={selectedStudent}
            />
          </div>
        </div>
      )}

      {/* Elevinfo panel */}
      {selectedStudent && (
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Elevinfo - {selectedStudent.fields.NummerID}
            </h2>
            <button
              onClick={() => setSelectedStudent(null)}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 w-24">Ålder:</span>
                <span className="text-gray-900">
                  {selectedStudent.fields.Födelseår ? calculateAge(selectedStudent.fields.Födelseår) : 'Okänd'} år
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500 w-24">Instrument:</span>
                <span className="text-gray-900">{selectedStudent.fields.Instrument || 'Inte angivet'}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {selectedStudent.fields.Samtalsanteckningar && (
                <div>
                  <span className="text-sm font-medium text-gray-500 block mb-2">Kommentar från vårdnadshavare:</span>
                  <div className="bg-blue-50 p-3 rounded-md border-l-3 border-blue-200">
                    <p className="text-gray-900 text-sm">{selectedStudent.fields.Samtalsanteckningar}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kommentar till din ansökan (valfritt)
                </label>
                <textarea
                  value={wishForm.kommentar}
                  onChange={(e) => setWishForm(prev => ({ ...prev, kommentar: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                  placeholder=""
                />
              </div>
              
              <button
                onClick={submitWish}
                disabled={wishForm.loading || !selectedStudent}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {wishForm.loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Skickar ansökan...
                  </span>
                ) : (
                  '🎯 Ansök om att undervisa denna elev'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
