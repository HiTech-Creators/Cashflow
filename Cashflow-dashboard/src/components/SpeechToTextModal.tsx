import { useEffect, useMemo, useState } from "react"
import useSpeechToText from "react-hook-speech-to-text"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mic, Send, Square, Trash2 } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  title?: string
  description?: string
  scenarioNameLabel?: string
  onSend: (args: { transcript: string; scenarioName?: string }) => Promise<void> | void
}

export function SpeechToTextModal({
  open,
  onOpenChange,
  title = "Speak now",
  description = "Your transcript will appear live. You can edit it before sending.",
  scenarioNameLabel = "Scenario name (optional)",
  onSend,
}: Props) {
  const {
    isRecording,
    results,
    interimResult,
    error,
    startSpeechToText,
    stopSpeechToText,
    setResults,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
  })

  const [scenarioName, setScenarioName] = useState("")
  const [draft, setDraft] = useState("")
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)

  const cleanup = () => {
    try {
      stopSpeechToText?.()
    } catch {
      // ignore
    }
    setTouched(false)
    setDraft("")
    setScenarioName("")
    try {
      setResults?.([])
    } catch {
      // ignore
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) cleanup()
    onOpenChange(v)
  }

  const liveText = useMemo(() => {
    const r = Array.isArray(results) ? results : []
    const stable = r
      .map((x: unknown) => {
        if (typeof x === "string") return x
        const maybe = x as { transcript?: unknown } | null
        const t = maybe?.transcript
        return typeof t === "string" ? t : ""
      })
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")

    const interim = typeof interimResult === "string" ? interimResult.trim() : ""
    return [stable, interim].filter(Boolean).join(" ").trim()
  }, [results, interimResult])

  useEffect(() => {
    if (!open) return
    if (touched) return
    setDraft(liveText)
  }, [open, touched, liveText])

  const canSend = draft.trim().length >= 5

  const onToggleRecording = async () => {
    if (!open) return
    if (isRecording) {
      stopSpeechToText?.()
      return
    }
    try {
      await startSpeechToText?.()
    } catch {
      // surface via error from hook/library
    }
  }

  const onClear = () => {
    setTouched(false)
    setDraft("")
    try {
      setResults?.([])
    } catch {
      // ignore
    }
  }

  const onSubmit = async () => {
    const transcript = draft.trim()
    if (!transcript) return
    setSending(true)
    try {
      await onSend({
        transcript,
        scenarioName: scenarioName.trim() ? scenarioName.trim() : undefined,
      })
      onOpenChange(false)
    } finally {
      setSending(false)
    }
  }

  const errorText = (() => {
    const err: unknown = error
    if (err == null) return ""
    if (typeof err === "string") return err
    if (typeof err === "object") {
      const maybe = err as { message?: unknown } | null
      if (typeof maybe?.message === "string") return maybe.message
    }
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  })()
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {!!errorText && (
          <Alert>
            <AlertDescription>{errorText}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>{scenarioNameLabel}</Label>
            <Input
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value ?? "")}
              placeholder="e.g. Q1 2026 plan"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Transcript</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClear} disabled={sending}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button type="button" onClick={onToggleRecording} disabled={sending}>
                  {isRecording ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Start
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Textarea
              value={draft}
              onChange={(e) => {
                setTouched(true)
                setDraft(e.target.value ?? "")
              }}
              placeholder="Your speech transcript will appear here…"
              className="min-h-[200px]"
            />

            {!canSend && (
              <p className="text-sm text-muted-foreground">
                Say a bit more (or type), transcript must be at least 5 characters.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!canSend || sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : "Send to backend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


