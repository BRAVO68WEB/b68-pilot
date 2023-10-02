import { runner } from "./runner"
import { Cron } from "croner"

console.log("Scheduling worker...")

const cron = new Cron("*/5 * * * *", {
    name: "gh-worker",
    timezone: "Asia/Kolkata",
})

cron.schedule(async () => {
    console.log("Running worker...")
    await runner()
    console.log("Worker ran!")
})

console.log("Worker scheduled successfully!")