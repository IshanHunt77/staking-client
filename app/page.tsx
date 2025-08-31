"use client"

import { useState, useMemo, useEffect } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider, WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as anchor from "@coral-xyz/anchor"
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js"
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token"
import { Program, type Idl } from "@project-serum/anchor"
import idl from "@/lib/idl.json"

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css"

const PROGRAM_ID = new PublicKey("6aVUKLFu9QKUEpApA8i1vqP8A3DdJqmebQ7QeYsCs6Lz")

function StakingInterface() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [amount, setAmount] = useState("")
  const [withdrawalTime, setWithdrawalTime] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("")

  const provider = useMemo(() => {
    if (!connection || !wallet) return null
    return new anchor.AnchorProvider(connection, wallet as unknown as anchor.Wallet, { commitment: "confirmed" })
  }, [connection, wallet])

  useEffect(() => {
    if (provider) anchor.setProvider(provider)
  }, [provider])

  const program = useMemo(() => {
    if (!provider) return null
    return new Program(idl as Idl, PROGRAM_ID, provider)
  }, [provider])

  const handleStake = async () => {
    if (!provider || !wallet || !wallet.publicKey || !program) {
      setStatus("Please connect your wallet first")
      return
    }

    if (!amount || !withdrawalTime) {
      setStatus("Please fill in all fields")
      return
    }

    setIsLoading(true)
    setStatus("Processing stake...")

    try {
      const mintKeypair = Keypair.generate()
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from("client1"), wallet.publicKey.toBuffer()], PROGRAM_ID)

      // Initialize PDA
      await program.methods
        .initialize()
        .accounts({
          pdaAccount: pda,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Create mint
      await program.methods
        .createMint()
        .accounts({
          signer: provider.wallet.publicKey,
          pdaAccount: pda,
          mint: mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([mintKeypair])
        .rpc()

      // Create ATA
      const ata = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        provider.wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      )

      const ataIx = createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        ata,
        provider.wallet.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID,
      )

      const ataTx = new Transaction().add(ataIx)
      await wallet.sendTransaction(ataTx, connection)

      // Store/Stake
      const lamportsToDeposit = new anchor.BN(Math.trunc(Number.parseFloat(amount) * LAMPORTS_PER_SOL))
      const duration = new anchor.BN(Number.parseInt(withdrawalTime) * 60) // Convert minutes to seconds

      await program.methods
        .store(lamportsToDeposit, duration)
        .accounts({
          pdaAccount: pda,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          mintAccount: mintKeypair.publicKey,
          tokenTo: ata,
        })
        .rpc()

      setStatus(`Successfully staked ${amount} SOL for ${withdrawalTime} minutes!`)
    } catch (error) {
      console.error("Staking error:", error)
      setStatus("Staking failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-8 border-border bg-primary">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-black text-primary-foreground font-mono tracking-tight">SOLANA STAKING</h1>
            <div className="flex gap-4">
              <WalletMultiButton className="!bg-accent !text-accent-foreground !border-4 !border-border !font-bold !px-6 !py-3 !text-lg hover:!bg-accent/90" />
              <WalletDisconnectButton className="!bg-destructive !text-destructive-foreground !border-4 !border-border !font-bold !px-6 !py-3 !text-lg hover:!bg-destructive/90" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left Side - Info */}
          <div className="space-y-8">
            <div className="border-8 border-border bg-card p-8">
              <h2 className="text-6xl font-black text-foreground mb-6 font-mono leading-none">STAKE YOUR SOL</h2>
              <p className="text-xl text-muted-foreground font-bold leading-relaxed">
                Lock your Solana tokens for a specified time period and earn rewards. Built on Solana's high-performance
                blockchain with instant finality.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-4 border-border bg-primary p-6">
                <h3 className="text-2xl font-black text-primary-foreground mb-2 font-mono">SECURE</h3>
                <p className="text-primary-foreground font-bold">
                  Smart contract audited and battle-tested on Solana mainnet
                </p>
              </Card>
              <Card className="border-4 border-border bg-accent p-6">
                <h3 className="text-2xl font-black text-accent-foreground mb-2 font-mono">FAST</h3>
                <p className="text-accent-foreground font-bold">Sub-second transaction times with minimal fees</p>
              </Card>
            </div>
          </div>

          {/* Right Side - Staking Form */}
          <div className="border-8 border-border bg-card p-8">
            <h3 className="text-3xl font-black text-foreground mb-8 font-mono">STAKE NOW</h3>

            <div className="space-y-6">
              <div>
                <Label htmlFor="amount" className="text-lg font-black text-foreground mb-2 block">
                  AMOUNT (SOL)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="border-4 border-border text-lg font-bold h-14 bg-input"
                  step="0.1"
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="withdrawal" className="text-lg font-black text-foreground mb-2 block">
                  LOCK TIME (MINUTES)
                </Label>
                <Input
                  id="withdrawal"
                  type="number"
                  placeholder="60"
                  value={withdrawalTime}
                  onChange={(e) => setWithdrawalTime(e.target.value)}
                  className="border-4 border-border text-lg font-bold h-14 bg-input"
                  min="1"
                />
              </div>

              <Button
                onClick={handleStake}
                disabled={isLoading || !wallet.connected}
                className="w-full h-16 text-xl font-black border-4 border-border bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {isLoading ? "PROCESSING..." : "STAKE SOL"}
              </Button>

              {status && (
                <div className="border-4 border-border bg-muted p-4">
                  <p className="text-muted-foreground font-bold text-center">{status}</p>
                </div>
              )}

              {!wallet.connected && (
                <div className="border-4 border-destructive bg-destructive/10 p-4">
                  <p className="text-destructive font-bold text-center">CONNECT WALLET TO CONTINUE</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-16 border-8 border-border bg-primary p-8">
          <div className="text-center">
            <h4 className="text-4xl font-black text-primary-foreground mb-4 font-mono">POWERED BY SOLANA</h4>
            <p className="text-xl text-primary-foreground font-bold max-w-2xl mx-auto">
              Experience the future of DeFi with lightning-fast transactions and minimal fees. Your staked tokens are
              secured by Solana's proof-of-stake consensus.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <ConnectionProvider endpoint="https://api.devnet.solana.com">
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <StakingInterface />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
