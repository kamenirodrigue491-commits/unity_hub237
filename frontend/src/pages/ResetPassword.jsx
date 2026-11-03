import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Lock, ArrowLeft, Loader2 } from 'lucide-react'
import api, { getApiErrorMessage } from '../api/axios'
import AuthLayout, { authInputClass, authLabelClass } from '../components/auth/AuthLayout'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [isLoading, setIsLoading] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    if (!token) {
      toast.error('Invalid reset link. Request a new one.')
      return
    }
    setIsLoading(true)
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      })
      toast.success('Password updated! Sign in with your new password.')
      navigate('/login')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not reset password. The link may have expired.'))
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This reset link is missing or expired">
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Request a new reset link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to sign in
      </Link>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="password" className={authLabelClass}>New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle pointer-events-none" />
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'At least 6 characters' },
              })}
              id="password"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className={authLabelClass}>Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle pointer-events-none" />
            <input
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (val) => val === watch('password') || 'Passwords do not match',
              })}
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            'Update password'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
