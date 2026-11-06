declare module "react-hook-speech-to-text" {
  export type SpeechResult = {
    transcript: string
    timestamp?: number
    speechBlob?: Blob
  }

  export type UseSpeechToTextOptions = {
    continuous?: boolean
    useLegacyResults?: boolean
    timeout?: number
    crossBrowser?: boolean
    googleApiKey?: string
    googleCloudRecognitionConfig?: unknown
    speechRecognitionProperties?: unknown
    onStartSpeaking?: () => void
    onStoppedSpeaking?: () => void
    useOnlyGoogleCloud?: boolean
  }

  export type UseSpeechToTextReturn = {
    error: string
    interimResult?: string
    isRecording: boolean
    results: SpeechResult[] | string[]
    setResults: (results: SpeechResult[]) => void
    startSpeechToText: () => Promise<void> | void
    stopSpeechToText: () => void
  }

  export default function useSpeechToText(options?: UseSpeechToTextOptions): UseSpeechToTextReturn
}


