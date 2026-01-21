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

      // Berika elever med vårdnadshavardata och koordinater
      const studentsWithData = allRecords
        .map((record: any) => {
          const guardianId = Array.isArray(record.fields.Vårdnadshavare)
            ? record.fields.Vårdnadshavare[0]
            : record.fields.Vårdnadshavare

          const guardianData = guardiansMap.get(guardianId) || {}

          // Hämta koordinater från eleven (lookup-fält) eller vårdnadshavaren
          const rawLat = record.fields.Latitude ?? guardianData.Latitude
          const rawLng = record.fields.Longitude ?? guardianData.Longitude

          // Konvertera till nummer
          const parsedLat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat)
          const parsedLng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng)

          return {
            ...record,
            guardianId: guardianId,
            fields: {
              ...record.fields,
              Samtalsanteckningar: record.fields.Samtalsanteckningar || guardianData.Samtalsanteckning || '',
              Gata: record.fields.Gata ?? guardianData.Gata,
              Gatunummer: record.fields.Gatunummer ?? guardianData.Gatunummer,
              Ort: record.fields.Ort ?? guardianData.Ort,
              Longitude: parsedLng,
              Latitude: parsedLat,
            }
          }
        })
        .filter((record: any) => {
          // Kräv vårdnadshavare med adressdata
          return record.guardianId && record.fields.Gata && record.fields.Ort
        })

      // Filtrera elever med giltiga koordinater inom Sverige
      const studentsWithValidCoordinates = studentsWithData.filter((student: any) => {
        const lat = student.fields.Latitude
        const lng = student.fields.Longitude

        if (isNaN(lat) || isNaN(lng)) {
          return false
        }

        return isValidSwedishCoordinates(lat, lng)
      })

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
            'Önskar': updatedWishes,
            'ÖnskaKommentar': wishForm.kommentar || ''
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <span className="text-gray-600">Laddar elevkarta...</span>
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
          Kartan visar alla elever som söker lärare.
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
