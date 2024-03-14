import { Hono } from "hono";

const app = new Hono();

app.all("*", async (ctx) => {
    console.log("[+] Got Request");
    const reqMethod = ctx.req.method;
    if(reqMethod !== "POST") 
        return ctx.json({
            ok: false, 
            error: "Method not allowed" 
        });
    const body = await ctx.req.json();

    console.log(body);
    
    return ctx.json({ ok: true });
});

console.log("WebHook Server Running on " + Number(process.env.PORT));

export default {
    fetch: app.fetch,
    port: Number(process.env.PORT),
} as any;