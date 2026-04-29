// a test GET route to check if the plugin is working
import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
    return NextResponse.json({ message: "Plugin is working" });
}