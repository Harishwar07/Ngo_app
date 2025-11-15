<<<<<<< HEAD
# Ngo_webapp
||||||| (empty tree)
=======
# NGO Web App — README

This document explains how to install dependencies and run the **frontend** and **backend** of the project.

---

## 🚀 Project Structure

```
/frontend     → Angular application
/backend      → Node.js + Express API server
```

---

# ✅ Backend Setup (Node.js + Express + PostgreSQL)

## 1. Go to backend folder
```
cd backend
```

## 2. Install dependencies
```
npm install express pg pg-pool dotenv bcrypt jsonwebtoken cookie-parser helmet cors express-rate-limit uuid morgan
```

## 3. Create `.env` file
Example:
```
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/ngodb
JWT_ACCESS_TOKEN_SECRET=your_secret
JWT_REFRESH_TOKEN_SECRET=your_secret
```

## 4. Run the backend

**Development mode:**
```
npm run dev
```

**Production mode:**
```
npm start
```

Backend runs at:
```
https://localhost:3001
```

---

# 🌐 Frontend Setup (Angular)

## 1. Go to frontend folder
```
cd frontend
```

## 2. Install dependencies
```
npm install
```


## 3. Set API URL  
Edit: `services/mockApi.ts`

## 4. Run the frontend
```
ng serve --open
```
Or:
```
npm start
```

Frontend runs at:
```
https://localhost:3000
```

---

# ▶️ Running Both Together

Open two terminals:

**Terminal 1: Backend**
```
cd backend
npm start
```

**Terminal 2: Frontend**
```
cd frontend
npm start
```

---
>>>>>>> 5fd0a65c (Initial commit)
