# GlobalPay specifications

These are the design-phase specifications written before and during development of the hackathon prototype. Code comments cite them by name and section (for example `PRD §7.3` or `api-contract.md §8`).

They describe the intended product, including some items that were planned but **not implemented** (for example PWA installation/offline support and hosted deployment). Where a specification and the code differ, the code and the [project README](../../README.md) describe what actually exists.

| Document | Contents |
|---|---|
| [GlobalPay_PRD_v1.2_MySQL_Prisma_Security_Hardened.md](GlobalPay_PRD_v1.2_MySQL_Prisma_Security_Hardened.md) | Product requirements document (cited as "PRD") |
| [architecture.md](architecture.md) | System architecture and module boundaries |
| [api-contract.md](api-contract.md) | API routes, request/response shapes and error codes |
| [database-schema.md](database-schema.md) | Data model design behind `prisma/schema.prisma` |
| [payment-flow.md](payment-flow.md) | PayPal Sandbox order, capture and reconciliation flow |
| [threat-model.md](threat-model.md) | Threats, mitigations and security release gates |
| [designs.md](designs.md) | UI and interaction design notes |
