# GeneMeds - Prescription Management Frontend

A responsive frontend application for doctors to create prescriptions, review drug and generic information, and view recommended diagnostic tests.

## Features

- Search and add medicines to a prescription
- Load the drug catalog from a backend API instead of a hardcoded list
- Add dosage, frequency, duration, and optional notes
- Form validation before prescription submission
- Remove individual medicines or clear all medicines
- Review generic medicine information from the backend catalog
- Multi-step prescription workflow:
  1. Create prescription
  2. Review drug and generic information
  3. View prescription completion and suggested tests
- Suggested clinical tests such as CBC, LFT, and KFT
- Responsive and clean medical dashboard UI

## Backend Contract

The frontend expects:

- `GET /api/drugs` or `VITE_DRUGS_API_URL`
- `POST /api/prescriptions` or `VITE_PRESCRIPTION_API_URL`

The drug catalog response can be either:

- a raw array of drugs
- `{ data: [...] }`
- `{ drugs: [...] }`
- `{ items: [...] }`

Each drug item can contain:

- `id` or `drugId`
- `name`, `drugName`, or `brandName`
- `strength`, `dosageForm`, or `presentation`
- `generics`, `genericNames`, `genericName`, or `activeIngredients`
- `source` or `sourceName`

When a prescription is uploaded, the frontend sends:

```json
{
  "prescriptionId": "draft-1710000000000",
  "prescribedAt": "2026-07-23T09:00:00.000Z",
  "prescribedDrugs": [
    {
      "drugId": 1,
      "drugName": "Amoxicillin",
      "strength": "500 mg capsule",
      "generics": ["Amoxicillin"],
      "selectedGeneric": "Amoxicillin",
      "dosage": "1 tablet",
      "frequency": "Once daily",
      "durationDays": 5,
      "note": "Take after food"
    }
  ]
}
```

The backend should use `drugId` as the primary identifier and can rely on the other fields for validation, matching, display, and audit logging.

## Tech Stack

- TypeScript
- Vite
- HTML5
- CSS3

## Run Notes

If PowerShell blocks `npm` scripts on Windows, run them through `cmd.exe`:

```bat
cmd /c npm install
cmd /c npm run dev
```

## Project Structure

```text
doctor-prescription-workflow/
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
|-- src/
|   |-- assets/
|   |-- main.ts
|   `-- style.css
|-- index.html
|-- package.json
`-- tsconfig.json
```
