from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        page.goto("http://localhost:8080/index.html")

        # 1. Verify EQ Tab and Panel
        print("Clicking EQ Tab...")
        page.click("#eqTabBtn")
        page.wait_for_selector("#eqPanel.active", state="visible")
        page.screenshot(path="verification_eq.png")
        print("EQ Tab verification screenshot saved to verification_eq.png")

        # 2. Verify Shortcuts Modal
        print("Clicking Shortcuts Button...")
        # Check if button exists and is visible
        if page.is_visible("#shortcutsBtn"):
            print("Shortcuts button is visible.")
            page.click("#shortcutsBtn")

            # Wait a bit
            page.wait_for_timeout(1000)

            # Check if modal has open attribute (standard for dialog)
            is_open = page.evaluate("document.getElementById('shortcutsModal').hasAttribute('open')")
            print(f"Modal open attribute: {is_open}")

            if is_open:
                page.screenshot(path="verification_shortcuts.png")
                print("Shortcuts Modal verification screenshot saved to verification_shortcuts.png")
            else:
                print("Modal did not open.")
                # Force show for screenshot if needed
                page.evaluate("document.getElementById('shortcutsModal').showModal()")
                page.screenshot(path="verification_shortcuts_forced.png")
        else:
            print("Shortcuts button NOT visible.")

        browser.close()

if __name__ == "__main__":
    verify_ui()
