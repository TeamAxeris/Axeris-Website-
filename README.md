# Axeris unified website and Plan Sponsor Console

This repository contains the public Axeris site and the complete local demo stack:

- Public website at `http://localhost:3002`
- Plan Sponsor Console at `http://localhost:3002/console/tpa/dashboard`
- Console application source in `apps/console/frontend`
- Local FastAPI and model/data services in `apps/console/backend`

## Getting Started

Install both JavaScript applications and the local Python API:

```bash
npm install
npm --prefix apps/console/frontend install
python3 -m pip install -r apps/console/backend/requirements.txt
```

Then start the entire local stack in one foreground command:

```bash
npm run dev:all
```

The command starts the website, console, and API together. `Try Live Demo` stays on the Axeris origin and opens the TPA Plan Sponsor Console by default.

The API seeds its local demo database and trains the bundled XGBoost, LightGBM, Isolation Forest, DBSCAN, meta-learner, and patient-context models before it accepts traffic. No remote model service is required.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
