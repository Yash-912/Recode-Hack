import { Component } from 'react'
import { AlertTriangle, Home } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f0f8ff] flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
              <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Oops!</h1>
            <p className="text-gray-600 mb-6">Something went wrong. Please try refreshing the page or go back to the home page.</p>
            <details className="mb-6 text-left bg-gray-100 p-4 rounded-lg text-sm">
              <summary className="cursor-pointer font-bold text-gray-700">Error Details</summary>
              <code className="block mt-3 text-red-700 font-mono text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                {this.state.error?.toString()}
              </code>
            </details>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Refresh Page
              </button>
              <a
                href="/"
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300 transition flex items-center justify-center gap-2"
              >
                <Home size={16} /> Home
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
