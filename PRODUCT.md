# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are retailer or club operators maintaining a shared tabletop RPG collection. They need to know what the organization owns, where physical material is stored, how it was acquired, and who may view or change the records.

## Product Purpose

Arcane Repository is a shared system of record for tabletop RPG inventory. It connects cataloging, physical location, acquisition history, and collection stewardship so operators can find material quickly and keep records trustworthy. Success means the repository accurately reflects what is owned, where it is, and how it relates to the rest of the collection.

## Positioning

Unlike a generic inventory list or spreadsheet, Arcane Repository keeps RPG items, miniatures, terrain, orders, publishers, systems, collections, categories, stores, and locations in one relational repository. Its distinctive value is the combination of physical collection findability, purchase-to-inventory traceability, and role-governed maintenance.

## Operating Context

Operators use the product in a browser to search the full repository, review collection dashboards, maintain inventory, record miniatures and terrain quantities, track purchase orders, and manage reference data. Google sign-in identifies users. Read-only, update, and administrator modes separate browsing, day-to-day maintenance, and system setup responsibilities.

The collection model includes publishers, RPG systems, collections, collection types, categories, sub-categories, locations, location types, stores, miniature sizes, miniature rarities, and statuses. Images may be attached to collections, items, and publishers.

## Capabilities and Constraints

- Inventory covers items, miniatures, terrain, and purchase orders with search, filtering, pagination, create, update, and delete workflows where permissions allow.
- Purchase-order details connect acquisitions to inventory items; dashboard coverage identifies items with and without purchase-order records.
- The application uses a React and TypeScript web client, a Node and Express API, and a Microsoft SQL Server relational database.
- Authentication uses Google OpenID Connect. Authorization is limited to the established `read-only`, `update`, and `administrator` application modes.
- Administrator-only setup maintains shared reference data and user access modes.
- The current deployment tooling targets a Vite frontend hosted through IIS and a separately running backend service.
- A product-specific accessibility standard has not yet been decided.

## Brand Commitments

The canonical product name is **Arcane Repository**. Preserve its concise grimoire-inspired language, including the established line "A grimoire of your own making," while keeping operational labels direct and understandable. The existing favicon is the current product mark.

## Evidence on Hand

- The working application and its product-facing copy are implemented under `frontend/src/`.
- The current product mark is `frontend/public/favicon.png`.
- The relational source schema is `tabletop_inventory_5nf.sql`, with subsequent changes under `scripts/migrations/`.
- Existing application data can provide real inventory counts, collection coverage, purchase history, and operational demonstrations.
- No customer testimonials, case studies, external press, performance benchmarks, or pricing evidence are present; future work must not fabricate them.

## Product Principles

1. Keep the whole RPG collection connected rather than reducing it to isolated lists.
2. Make ownership and physical location fast to verify during real operations.
3. Preserve acquisition history as part of the inventory record.
4. Match every action to the user's granted stewardship level.
5. Prefer accurate collection evidence over decorative or invented claims.