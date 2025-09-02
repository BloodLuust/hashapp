export type ResultDoc = {
  _id?: string
  source: 'random' | 'range' | 'specific'
  input: {
    private_key_hex?: string
    xpub?: string
  }
  bip39: {
    mnemonic: string | null
    seed_hex: string | null
    note?: string
  }
  extended_keys: {
    xprv: string
    xpub: string
    yprv: string
    ypub: string
    zprv: string
    zpub: string
    root_fingerprint: string
  }
  results: {
    bitcoin?: {
      p2pkh?: DerivationResult
      p2sh_p2wpkh?: DerivationResult
      p2wpkh?: DerivationResult
    }
  }
}

export type AddressEntry = {
  index: number
  address: string
  derivationPath?: string
  api?: {
    blockchair?: any
    tatum?: any
  }
  tx_count?: number
}

export type DerivationResult = {
  accountPath: string
  addresses: AddressEntry[]
  active_indices?: number[]
}

