# Interactive Order Management System for Bus Wi-Fi & CCTV

This plan outlines the creation of an interactive web application that takes the static business logic from `bus_wifi_management.html` and turns it into a fully functional system for generating customer invoices, recommendations, and backend profit analysis.

## Proposed Changes

We will build a full-stack **Next.js** application. This satisfies the requirement for "proper front end and back end tools". Next.js provides robust React-based frontend components while allowing us to securely handle the revenue calculations and invoice generation via its backend API routes.

### App Location
The app will be initialized in a new folder at your workspace: 
`c:\Users\Hp\Desktop\BUS MANAGEMNET SYSTEM\bus-wifi-app`

### 1. Interactive Order Management (Frontend)
A responsive customer-facing sales UI that collects:
- **Wi-Fi Requirement**: Basic (5 Mbps) vs. Premium (10 Mbps)
- **Duration**: 1 Month, 6 Months, or 1 Year.
- **CCTV Add-On**: Number of cameras the customer wants (0 to 8).
- **Type**: New Setup vs. Renewal phase.
  
The UI will feature dynamic pricing that actively reflects the recommendations and total cost to the customer based on the selected scenario.

### 2. Invoice Generation View (Frontend + Print)
An invoice page that generates a detailed breakdown for the customer taking into account:
- Wi-Fi Package charges
- Camera setup charges (Rs. 6,000 per camera customer charge)
- Total Amount Due

### 3. Revenue Stream & Cost Calculation (Backend Logic)
We will create backend modules (or specialized admin views) that execute the **Developer Rules** outlined in your document:
- **Labor Cost Scaling**: Adjusting labor costs automatically (1,500 for <= 2 cams, 2,000 for >= 3 cams).
- **Unit Economics Calculation**: Tallying hardware costs (Router, Cams, Memory, Accessories).
- **Telecom Cost Logic**: Factoring in the initial costs and eSewa cashback for renewals.
- **1-Year Premium Split Logic**: Automatically projecting costs sequentially (Phase 1 Premium, Phase 2 Basic) for maximum profit modeling.
- **Profit Summary**: Outputting the final initial profit and expected 1-year total profit for the given scenario.

### 4. Logo Integration
We will prominently feature the uploaded `Final logo design` in the UI to give the app a premium, official look.

## User Review Required

> [!IMPORTANT]  
> Are you comfortable using **Next.js** (a React-based framework) for this application? It handles both the frontend UI and the backend logic seamlessly within a single repository, making it perfect for your requirements. If approved, I will run the command to create the application and implement all the formulas.

## Verification Plan

### Automated/Manual Verification
1. I will run `npx create-next-app` to set up the project.
2. I will implement the interactive form, invoice generator, and admin revenue components.
3. I will test the logic. For example, selecting a 6-Month Premium setup with 3 cameras should yield a total revenue of Rs. 33,000, Total Cost of Rs. 24,600, and Initial Profit of Rs. 8,400, perfectly matching "Case 2" in your document.
4. Please review the implementation plan and approve it so we can begin coding!
