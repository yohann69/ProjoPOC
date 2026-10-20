import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/reportError'

interface Props {
  /** Names the part of the UI in the fallback message. */
  label: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Keeps one failing panel from blanking the whole window; the error goes to the log file. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-lg border border-red-500 bg-red-950 p-3 text-sm text-red-100"
      >
        <p className="font-semibold">{this.props.label} stopped working.</p>
        <p className="break-words text-red-200">{error.message}</p>
        <p className="text-xs text-red-300">
          The error was written to the log file (see the Diagnostics tab).
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="w-fit rounded border border-red-300 px-3 py-1 font-semibold outline-none hover:bg-red-900 focus-visible:ring-2 focus-visible:ring-white"
        >
          Try again
        </button>
      </div>
    )
  }
}
