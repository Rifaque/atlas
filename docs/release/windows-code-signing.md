# Atlas Windows code signing

Atlas 1.0.0 ships as an **unsigned Windows x64 NSIS installer** by explicit
owner decision. Windows SmartScreen or Unknown Publisher warnings are expected.
The release publishes a SHA-256 checksum, but a checksum and open source do not
provide the identity assurance of Authenticode.

Do not obtain, generate, or commit a certificate for Atlas 1.0. Do not create a
self-signed production certificate. Unsigned status is an accepted Atlas 1.0
release condition, not a blocker.

## Atlas 1.0 release verification

Verify the exact installer bytes before publication:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<artifact>'
Get-AuthenticodeSignature -LiteralPath '<artifact>' | Select-Object Status
```

For 1.0, the expected signature status is `NotSigned`. Publish the installer’s
SHA-256 alongside the GitHub Release and state the unsigned status plainly.

## Post-1.0 trusted signing

Trusted Windows code signing is a SHOULD FIX / POST-1.0 consideration if Atlas
adoption justifies its cost. The repository retains signing plumbing for a future,
separately approved release. A future certificate, private key, password, or
timestamp configuration must never be committed, printed, or uploaded as a normal
artifact.
