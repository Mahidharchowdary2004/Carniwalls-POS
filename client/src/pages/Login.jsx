import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import toast from 'react-hot-toast'

export default function Login() {
  const [type,     setType]     = useState('cashier') // 'cashier' | 'admin'
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [otp,      setOtp]      = useState(['', '', '', '', '', ''])
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]
  const { login } = useStore()
  const navigate  = useNavigate()

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    
    // Move to next box
    if (value && index < 5) {
      otpRefs[index + 1].current.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus()
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const isAdmin = type === 'admin'
      const identifier = isAdmin ? phone : email
      const finalPass = isAdmin ? otp.join('') : password
      
      if (isAdmin && !/^\d{10}$/.test(identifier)) {
        toast.error('Phone number must be exactly 10 digits')
        setLoading(false)
        return
      }
      
      // For demo: Admin OTP is 123456 or just matches 'admin123' if we treat it as password
      // I will send it as 'password' to the backend
      await login(identifier, finalPass, isAdmin)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch {
      toast.error('Invalid credentials')
    } finally { setLoading(false) }
  }

  // Auto focus first OTP box when switching to admin
  useEffect(() => {
    if (type === 'admin' && otpRefs[0].current) {
      otpRefs[0].current.focus()
    }
  }, [type])

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
      <div style={{ width: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src="./logo.png" alt="Logo" style={{ width: 180, marginBottom: 10 }} />
          <div style={{ fontSize: 13, color: '#5a6478', fontWeight: 500 }}>Cloud Restaurant Management System</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e6ec', borderRadius: 20, padding: 36, boxShadow: '0 12px 30px rgba(0,0,0,0.06)' }}>
          
          {/* Tab Nav */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 5, borderRadius: 12, marginBottom: 28 }}>
            <button 
              onClick={() => setType('cashier')}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: type === 'cashier' ? '#fff' : 'transparent', color: type === 'cashier' ? '#c0392b' : '#64748b', boxShadow: type === 'cashier' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none', transition: '0.3s' }}
            >
              👩‍💻 Cashier
            </button>
            <button 
              onClick={() => setType('admin')}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: type === 'admin' ? '#fff' : 'transparent', color: type === 'admin' ? '#c0392b' : '#64748b', boxShadow: type === 'admin' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none', transition: '0.3s' }}
            >
              👨‍💼 Admin
            </button>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#1a1f2e' }}>
            {type === 'cashier' ? 'Welcome Cashier' : 'Admin Verification'}
          </h2>
          <p style={{ fontSize: 13, color: '#5a6478', marginBottom: 28 }}>
            {type === 'cashier' ? 'Access your POS terminal with your email.' : 'Enter your 6-digit verification code.'}
          </p>

          <form onSubmit={handleSubmit}>
            {type === 'cashier' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cashier@restauraq.com" required />
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Password</label>
                  <input 
                    className="form-input" 
                    type={showPass ? 'text' : 'password'} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: 32, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.5 }}
                  >
                    {showPass ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    className="form-input" 
                    type="tel" 
                    value={phone} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setPhone(val)
                    }} 
                    maxLength={10}
                    placeholder="9876543210" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Security OTP</label>
                    <button 
                      type="button" 
                      onClick={() => setShowPass(!showPass)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#c0392b', fontWeight: 600 }}
                    >
                      {showPass ? 'Hide Digits' : 'Show Digits'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={otpRefs[i]}
                        type={showPass ? 'text' : 'password'}
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        style={{ width: '100%', height: 50, textAlign: 'center', fontSize: 20, fontWeight: 800, borderRadius: 10, border: '2px solid #e2e8f0', background: '#f8fafc', transition: '0.2s', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = '#c0392b'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <button type="submit" style={{ width: '100%', padding: 15, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'inherit', marginTop: 15, transition: '0.2s' }} disabled={loading} onMouseOver={e => e.target.style.opacity = 0.9} onMouseOut={e => e.target.style.opacity = 1}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> : 'Authenticate →'}
            </button>
          </form>


        </div>

        <div style={{ textAlign: 'center', marginTop: 25, fontSize: 12, color: '#9aa3b5' }}>
          Secure Cloud Infrastructure • <b>RestauraQ</b> v2.4.0
        </div>
      </div>
    </div>
  )
}
