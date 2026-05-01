# Dashboard
## What's new
The "What's new" section is going to show all the updates since yesterday, and mainly orders, or managed emails. This section is a table that has multiple rows in it, but the entire section should not take up more than 40% of the full height. On the bottom it should have a button that says "All (x)" where "x" is a number that represents all the new entries in the "What's new" section. 

Every row has 4 cells. 
- First cell contains the client company logo that the email about an order belongs to, or if the update is about a regular email, like  spam, then an actual email icon should be shown. 
- The second cell should contain text in 2 rows. In the first row it should tell the summary, and below the details, but not all the details just as much as 2 lines of text, and if there's more text, then a "...". This cell should take up 50% of the width of the row, because this is the most important information about an entry. 
- In the third cell that should take up 30% of the width of the row, there should be text that will be the "Suggestion", so what the AI suggests to be done with that entry. 
- In the last cell there should be 2 buttons, one check mark with a green background, and a pencil button with a blue background. The first and the last cell should take up 10-10% of the width of the row.

If an order or email becomes processed outside of the dashboard (for example CK goes into another section and processes it there), it should be highlighted in this dashboard element as well. Instead of the action buttons, a simple gray icon showing "Processed" in italic type should appear on the right side.

### Layout Options
- The entire left sidebar (Menu + AI chat) has a draggable right edge. It can be dynamically resized between 10% and 30% of the total screen width.

### Modals
- **All Updates Modal:** Triggered by "View all updates". Opens a pop-up showing the history of all updates out of the 40% height constraint. The updates are visually grouped by Day.
- **Entry Details Modal:** Triggered by the Pencil icon on a specific entry row. A large pop-up window divided into two columns:
  - **Left Column (Context & AI Analysis):** Client name and ID at the top. Below that, a "Summary" box, a "Detailed Description" plain text area, and an "AI Suggestion" highlighted box at the bottom.
  - **Right Column (P.I.S.T.A. Assistant):** A dedicated chat interface on the right side to converse with the AI specifically about this update/order, complete with an input field and close button.

## Active orders + Details section
Below the "What's new?" section there should be one single overarching card container that is split into 2 columns vertically, with a visual divider line in between. The one on the left taking up 65% of the width, and the one on the right taking up 35%. 
There is no "Details" title shown on the right side, just the content.

The one on the left should be named "Active Orders". This should be a list of all the active business orders, and each row should multiple columns as information:

- The first column should be a narrow one, with the client company logo.

- The second column should display the client company name.

- The third column should display the unique `order_code` (e.g. HILT-00001).

- The fourth column should be the status of the order business from the business workflow (attached screenshot) alongside the plain text status.

- The last column should be the status of the order business from the business workflow (attached screenshot). If there are attached documents (files) for the order, a paperclip icon should also be displayed at the end of this cell.

Each columns should have a title on the top, and I should  be able to arrange the whole table based on any of the columns, except for the first, logo column.

This table should also have the hover highlight effect.

Default it should be ordered by the Updated date with the latest on the top.



In the right column of the section below the "What's new" section should be just the same heigth as the "Active orders". By default this should be empty, but when I click on an entry under the "Active orders" column, it should show me the details of that entry in this column:

- On the top should be the client company name, logo, the unique `order_code`, and the last update date.

- Below that, if there are any attached files associated with the order, they should be displayed as clickable File chips with icons.

- Below that, the ordered items with their quantities, prices, and a total sum.
  
- Below that a summary of the last update with the belonging workflow status, and the timeline going down with the same for the events of the order together with statuses and update dates.