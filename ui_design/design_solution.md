CoolKonyha Dashboard – Design Handoff Documentation

This documentation records the visual and structural specifications of the CoolKonyha AI Dashboard for implementation within the Google Antigravity environment.

1. Color Palette (Core Palette)

The design strictly utilizes the following hex codes to ensure high contrast and professional aesthetics:

Primary Colors (Dark Mode)

Main Background: #081426 (Deep Oxford Blue)

Card/Sidebar Base: #012340 (Rich Navy)

Primary Text (All): #DCEAF7 (Ice Blue)

Accent Headers (Right Sections): #0077B6 (Ocean Blue)

Hover State: #5482B4 (Medium Blue)

Status Highlights (Chinese Bronze): #D98032

System Accent (Cyan): #07B2D9

Light Mode (Alternate State)

Main Background: #f8fafc

Cards: #ffffff

Sidebar Gradient: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)

2. Structural Specifications

Integrated Sidebar (Menu + AI Chat)

Layout: The left column (w-80) is a single, continuous block merging navigation and chat.

Chat Logic:

Bottom-up: Messages start from the bottom and populate upwards.

50% Fade Effect: Once chat text reaches 50% of the column height, it must fade out using a mask to keep the top menu items legible.

User Bubbles: User messages appear in a subtle ice-blue rounded bubble (rgba(220, 234, 247, 0.15)).

AI Messages: AI responses are text-only with NO background, maintaining a clean look.

"Carved-out" Input Field

The input container at the very bottom of the Sidebar must look like it is physically carved into the column.

Style: Inset shadow, darker background (#081426), and a border that blends with the sidebar.

Features: Must include the paperclip icon (left), text input (middle), and paper-plane button (right).

Active Pipeline Search

The "Active Processes" (Aktív Folyamatok) section must contain a high-contrast search/filter bar in its header to allow global filtering of orders.

3. Technical CSS Implementations

Precision Shadows (Anti-Rectangle Clipping)

To avoid "rectangular shadow" artifacts on large monitors (32" LG UltraGear), use a two-layer container approach:

Outer (Shadow-container): Holds the filter: drop-shadow(6px 6px 8px rgba(0, 119, 182, 0.3)). It must have NO overflow: hidden.

Inner (Card-inner): Holds the background color, the border-radius: 2.5rem, and overflow: hidden for content.

Message Masking (50% Fade)

Apply the following mask to the chat scroll area:

mask-image: linear-gradient(to top, black 50%, transparent 100%);
-webkit-mask-image: linear-gradient(to top, black 50%, transparent 100%);


4. Instructions for Claude (Implementation Guide)

Claude, please build the code according to these priorities:

Strict Color Adherence: Do not use generic grays. Stick to the #081426 and #DCEAF7 contrast.

Modern UI Polish: Use Tailwind CSS for the layout, but define the custom masks and precision shadows in a dedicated <style> block.

Language: Ensure all UI labels remain in Hungarian (e.g., Irányítópult, Aktív Folyamatok).

Typography: Keep font sizes professional (text-xs and text-sm). Use Inter as the primary font family.

Responsiveness: The layout should fill the screen height (h-screen) without vertical body scrolling.