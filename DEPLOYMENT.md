# Cloud Deployment Guide - AI Product Manager Copilot

This guide outlines the steps to deploy your full-stack application (Flask backend, React frontend, and PostgreSQL database) to the cloud.

---

## 🏛️ Deployment Architecture

* **Frontend:** React (Vite) hosted on **Vercel** or **Netlify**.
* **Backend:** Flask hosted on **Render** (Web Service) or **Railway**.
* **Database:** PostgreSQL hosted on **Neon.tech** or **Supabase**.

---

## 🐘 Step 1: Set Up Cloud PostgreSQL (Neon)

1. Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2. Create a project named `ai-pm-copilot`.
3. In the Neon Dashboard, copy the connection URL from the **Connection Details** box. It will look like this:
   `postgresql://alex:password@ep-cool-rain-1234.us-east-2.aws.neon.tech/neondb?sslmode=require`

---

## 🚀 Step 2: Deploy Backend (Render)

1. Sign up for a free account on [Render](https://render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository `AI-Product-Manager-Copilot`.
4. Configure the Web Service settings:
   * **Name:** `ai-pm-copilot-backend`
   * **Region:** (Select the region closest to you)
   * **Branch:** `main`
   * **Root Directory:** `backend`
   * **Runtime:** `Python`
   * **Build Command:** `pip install -r requirements.txt && python database/run_migration.py`
   * **Start Command:** `gunicorn wsgi:app`
5. Click **Advanced** and add the following **Environment Variables**:
   * `DATABASE_URL` = (Paste your Neon PostgreSQL connection string from Step 1)
   * `GEMINI_API_KEY` = (Your Google Gemini API Key)
   * `GEMINI_MODEL` = `gemini-3.6-flash`
   * `JWT_SECRET_KEY` = (Any random string for authentication session tokens)
6. Click **Create Web Service**. 
7. Once deployed, copy your backend URL (e.g. `https://ai-pm-copilot-backend.onrender.com`).

---

## 🖥️ Step 3: Deploy Frontend (Vercel)

1. Sign up at [Vercel](https://vercel.com/) (connecting with GitHub is recommended).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository `AI-Product-Manager-Copilot`.
4. Configure the project settings:
   * **Framework Preset:** `Vite`
   * **Root Directory:** `frontend`
5. Add the following **Environment Variable**:
   * `VITE_API_URL` = (Paste your Render Backend API URL from Step 2)
6. Click **Deploy**.
7. Vercel will build the frontend and provide you with a public URL to access your application from anywhere!
