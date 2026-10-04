import os
from playwright.sync_api import sync_playwright

def test_playwright_templates():
    html_content = """
    <!DOCTYPE html>
    <html lang="te">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; margin: 0; padding: 0; }
            .masthead { border-bottom: 4px solid red; margin-bottom: 20px; text-align: center; }
            .content { column-count: 4; column-gap: 15px; }
            .article { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ccc; padding: 10px; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="masthead">
            <h1>RTI Express - Telugu Daily - HUGE MASTHEAD</h1>
        </div>
        <div class="content">
    """
    for i in range(40):
        html_content += f"""
            <div class="article">
                <h2>Article {i}</h2>
                <p>{"This is some text. " * 30}</p>
            </div>
        """
    html_content += """
        </div>
    </body>
    </html>
    """

    header_template = """
    <div style="width: 100%; font-size: 11px; font-weight: bold; border-bottom: 2px solid green; margin: 0 10mm; padding-bottom: 5px; display: flex; justify-content: space-between; font-family: sans-serif;">
        <span style="color: green;">RTI Express — దినపత్రిక</span>
        <span>Date here | పేజీ <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
    """

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content)
        page.pdf(
            path="test_headers.pdf",
            format="A3",
            print_background=True,
            display_header_footer=True,
            header_template=header_template,
            footer_template="<div></div>", # Empty footer
            margin={"top": "20mm", "bottom": "10mm", "left": "10mm", "right": "10mm"}
        )
        browser.close()

if __name__ == "__main__":
    test_playwright_templates()
