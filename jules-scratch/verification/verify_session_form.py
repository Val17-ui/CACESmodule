from playwright.sync_api import sync_playwright, expect, Page
import time

def verify_session_form(page: Page):
    # The electron app starts on the dashboard page
    # Click on the "Sessions" link in the sidebar
    page.get_by_role("link", name="Sessions").click()

    # Click on the "add" button to create a new session
    page.get_by_role("button", name="add").click()

    # Wait for the form to appear
    expect(page.get_by_text("Informations générales")).to_be_visible()

    # Fill in the form
    page.get_by_label("Nom de la session").fill("Test Session")
    page.get_by_label("Date de la session").fill("2025-01-01")
    page.get_by_label("Numéro de session").fill("12345")
    page.get_by_label("Numéro de stage").fill("67890")
    page.get_by_label("Lieu de formation").fill("Test Location")
    page.get_by_label("Notes").fill("These are some test notes.")

    # Click on the "Participants" tab
    page.get_by_role("button", name="Participants").click()

    # Wait for the participants tab to be visible
    expect(page.get_by_text("Gestion des participants")).to_be_visible()

    # Click back on the "Détails Session" tab
    page.get_by_role("button", name="Détails Session").click()

    # Wait for the details tab to be visible again
    expect(page.get_by_text("Informations générales")).to_be_visible()

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        # Give the app time to start
        time.sleep(15)

        print("Connecting to the browser...")
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        print("Connected to the browser.")

        # The electron app usually has one context
        context = browser.contexts[0]

        # Wait for the first page to be created
        print("Waiting for page...")
        page = context.pages[0] if context.pages else context.wait_for_event("page")
        print("Page found.")

        # It can take a moment for the window to load the content
        print("Waiting for page to load...")
        page.wait_for_load_state('domcontentloaded')
        print("Page loaded.")

        verify_session_form(page)

        browser.close()

if __name__ == "__main__":
    main()
