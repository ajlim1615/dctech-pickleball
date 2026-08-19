# 🏓 DCPaddl — System User & Administrator Guide

**DCPaddl** is the official DCTECH internal employee pickleball platform, designed for managing open-play sessions, virtual paddle rotation queues, live court-side umpiring, and company-wide rankings.

---

## 📌 Table of Contents
1. [Pickleball Quick Rules for Beginners](#1-pickleball-quick-rules-for-beginners)
2. [Platform Workflow Overview](#2-platform-workflow-overview)
3. [Player & Spectator Guide](#3-player--spectator-guide)
4. [Sports Staff Umpire Guide](#4-sports-staff-umpire-guide)
5. [Administrator Guide](#5-administrator-guide)
6. [Scoring & Rating Mathematics](#6-scoring--rating-mathematics)

---

## 1. Pickleball Quick Rules for Beginners

### The 3 Golden Rules
1. **The Serve**: Always hit underhand diagonally across the court. The ball must clear the 7-foot "Kitchen" zone.
2. **The Two-Bounce Rule**: After the serve, the ball must bounce once on the receiving side and once on the serving side before any player can hit a volley out of the air.
3. **The Non-Volley Zone ("The Kitchen")**: You cannot step inside the 7-foot zone near the net and hit a ball out of the air. You may only enter the Kitchen if the ball bounces there first.

### Understanding the 3-Number Score (e.g. `9 - 7 - 2`)
Pickleball doubles scores are called as:
$$\text{Serving Score} - \text{Receiving Score} - \text{Server Number (1 or 2)}$$
- **Only the serving team can score points.**
- If the receiving team wins a rally, it is a **Side-Out** (the ball turns over, no point awarded).
- Games are played to **11 points (must win by 2)**.

---

## 2. Platform Workflow Overview

```
[ 1. Schedule Session ] ──> [ 2. Player Check-in ] ──> [ 3. Virtual Queue ]
     (/admin)                    (/sessions)                  (/queue)
                                                                 │
                                                                 ▼
[ 6. Rankings Update ]  <── [ 5. Match Recorded ]  <── [ 4. Court Call-Up ]
     (/rankings)             (/courts/[id]/monitor)        (Phone Vibrate)
```

---

## 3. Player & Spectator Guide

### Step 1: Check In to Today's Session
1. Navigate to `/sessions`.
2. Find the active event (e.g., *Wednesday Night Open Play*).
3. Click **"Check In"** to add yourself to the venue attendance roster.

### Step 2: Join the Virtual Queue
1. Go to `/queue`.
2. Choose:
   - **Join Solo**: The algorithm will group you with other available players.
   - **Join as Doubles Pair**: Enter your partner's name so you play on the same team.
3. Watch your position and live estimated wait time update automatically.

### Step 3: Match Call-Up
- When your court is ready, your device will **vibrate** and display a green notification banner:
  > **🎉 "Court 1 is ready for you! Head to the court with your paddle."**

### Step 4: Watch Live Scoreboards
- Anyone in the office or lounge can view all 4 courts updating in real time on the **Live Court Matrix** (`/`).

---

## 4. Sports Staff Umpire Guide

Sports Staff members are stationed at courts to manage match flow and scorekeeping.

### Accessing Court Monitor Mode (`/courts/[id]/monitor`)
1. On the home page or admin panel, click **"Umpire Mode"** for your assigned court (Court 1, 2, 3, or 4).
2. **Scoring Controls**:
   - `+ Point (Server)`: Adds a point and updates public scoreboards instantly.
   - `Side Out / Fault`: Automatically rotates Server 1 to Server 2, or turns the serve over to Team 2.
   - `60s Timeout`: Starts a one-minute timer with visual countdown.
3. **Queue Call-Up**:
   - Once a match completes, tap **"Call Queue"** to auto-assign the next 4 waiting players from the queue.
4. **Finalizing Match**:
   - Tap **"Complete Game & Record Score"** to calculate the winner and update company rankings.

---

## 5. Administrator Guide (`/admin`)

Admins and Sports Committee leaders have full operational control:

- **Court Facility Overrides**: Change court status (*Available, Occupied, Maintenance, Reserved*).
- **Session Scheduler**: Create and publish scheduled open-play events with start/end times and capacity caps.
- **Player Directory**: Adjust employee DUPR skill ratings and toggle admin permissions.
- **Emergency Queue Controls**: Reset or purge the waiting queue if needed.

---

## 6. Scoring & Rating Mathematics

### Estimated Wait Time Calculation
$$\text{Estimated Wait (minutes)} = \left\lceil \frac{\text{Queue Position}}{\text{Active Courts} \times 4} \right\rceil \times \text{Avg Game Duration (12m)}$$

### DUPR Skill Rating Scale
- **2.0 – 2.5**: Beginner (learning serve & basic rallies)
- **3.0 – 3.5**: Intermediate (consistent dinking & third shot drops)
- **4.0 – 4.5**: Advanced (strategic shot placement & high pace control)
- **5.0+**: Pro / Expert (tournament-level precision)

---
*© 2026 DCTECH Recreational Committee • DCPaddl Platform*
