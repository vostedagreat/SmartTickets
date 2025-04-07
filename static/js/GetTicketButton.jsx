import React, { useState } from 'react'
import axios from 'axios'

export default function GetTicketButton({ eventId }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleGetTicket = async () => {
    if (!phone) {
      setMessage('Please enter your phone number.')
      return
    }

    try {
      setLoading(true)
      setMessage('')
      const response = await axios.post('/initiate_payment', {
        phone,
        event_id: eventId,
      })
      setMessage(response.data.ResponseDescription || 'STK push sent!')
    } catch (err) {
      setMessage('Payment request failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="tel"
        placeholder="Enter Safaricom number e.g. 2547..."
        className="p-2 border rounded w-full"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <button
        onClick={handleGetTicket}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        {loading ? 'Processing...' : 'Get Ticket'}
      </button>
      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  )
}
