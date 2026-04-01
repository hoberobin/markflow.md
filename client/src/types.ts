export interface PresencePeer {
  clientId: number
  name: string
  color: string
  file?: string
}

export interface InsertSignal {
  text: string
  mode: string
  ts: number
}
