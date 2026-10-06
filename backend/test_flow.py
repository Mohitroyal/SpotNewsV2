import os
from playwright.sync_api import sync_playwright

def render_test_pdf():
    html_content = """
    <!DOCTYPE html>
    <html lang="te">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; margin: 0; padding: 0; font-size: 14px; }
            .masthead { border-bottom: 4px solid red; margin-bottom: 20px; text-align: center; }
            .content { column-count: 4; column-gap: 15px; }
            .article { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ccc; padding: 10px; margin-bottom: 15px; }
            .article-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; }
            .lead { column-span: all; border-color: red; }
        </style>
    </head>
    <body>
        <div class="masthead">
            <h1>RTI Express - Telugu Daily</h1>
        </div>
        <div class="content">
            <div class="article lead">
                <div class="article-title">LEAD STORY SPANNING ALL COLUMNS</div>
                <p>This is the lead story. It spans across all columns. It has a lot of text to prove it spans. </p>
            </div>
    """
    
    for i in range(50):
        html_content += f"""
            <div class="article">
                <div class="article-title">Article {i}</div>
                <p>{"This is some text for the article to make it long enough to see how it flows. " * (i % 5 + 2)}</p>
            </div>
        """
        
    html_content += """
        </div>
    </body>
    </html>
    """

    footer_template = """
    <div style="font-size: 10px; font-weight: bold; width: 100%; border-top: 2px solid black; margin: 0 10mm; padding-top: 5px; display: flex; justify-content: space-between;">
        <span>RTI EXPRESS — TELUGU DAILY</span>
        <span>PAGE <span class="pageNumber"></span> OF <span class="totalPages"></span></span>
    </div>
    """

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content)
        page.pdf(
            path="test_flow.pdf",
            format="A3",
            print_background=True,
            display_header_footer=True,
            header_template="<div></div>",
            footer_template=footer_template,
            margin={"top": "10mm", "bottom": "15mm", "left": "10mm", "right": "10mm"}
        )
        browser.close()

if __name__ == "__main__":
    render_test_pdf()
