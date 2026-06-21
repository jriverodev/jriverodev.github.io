import asyncio
from playwright.async_api import async_playwright
import os

async def verify_responsive_layout():
    async with async_playwright() as p:
        # Use mobile emulation
        iphone_13 = p.devices['iPhone 13']
        browser = await p.webkit.launch()
        context = await browser.new_context(**iphone_13)
        page = await context.new_page()

        # Load the local panel.html file
        file_path = os.path.abspath("tto-gestion-flota/panel.html")
        await page.goto(f"file://{file_path}")

        # Wait for potential script execution (though data fetch will fail locally)
        await page.wait_for_timeout(2000)

        # Take a screenshot to verify the empty state table/card structure
        await page.screenshot(path="verify_mobile_layout.png")

        # Check if the table has the 'block' class on mobile
        tbody_is_block = await page.evaluate("() => getComputedStyle(document.getElementById('tablaEditableCuerpo')).display === 'block'")
        print(f"Mobile tbody is block: {tbody_is_block}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_responsive_layout())
