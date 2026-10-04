import os
import json
from typing import List, Dict, Any

def generate_newspaper_page(articles: List[Dict[str, Any]], page_num: int, total_pages: int, date_str: str) -> str:
    # A professional Telugu Newspaper Layout generator
    
    # Header for Page 1
    header_html = ""
    if page_num == 1:
        header_html = f"""
        <div class="masthead">
            <div class="masthead-top">
                <span>Regd.No: AP/TEL/2026/01</span>
                <span>హైదరాబాద్ | RNI: APTEL/2026/XXXX</span>
                <span>పేజీలు: {total_pages} | వెల: రూ. 1.50/-</span>
            </div>
            <div class="masthead-logo">
                <img src="https://i.ibb.co/3sX8M8j/logo.png" alt="RTI Express" />
            </div>
            <div class="masthead-info">
                <span>సంపుటి: 01</span>
                <span>సంచిక: 271</span>
                <span>ఎడిటర్: స్పాట్ న్యూస్</span>
                <span>{date_str}</span>
            </div>
        </div>
        """
    else:
        header_html = f"""
        <div class="masthead-small">
            <img src="https://i.ibb.co/3sX8M8j/logo.png" alt="RTI Express" />
            <span>పేజీ {page_num} | {date_str}</span>
        </div>
        """

    # We will lay out the articles using CSS masonry/columns or flex grid
    articles_html = ""
    
    for i, art in enumerate(articles):
        # alternate layouts based on index to create a newspaper feel
        headline = art.get("headline", "")
        content = art.get("content", "")
        img_url = art.get("image_urls", [art.get("image_url", "")])[0] if art.get("image_urls") else art.get("image_url", "")
        
        # Decide block style
        if i == 0 and page_num == 1:
            # Lead story
            block_class = "lead-story"
            col_count = 4
        elif i % 5 == 0:
            block_class = "feature-story"
            col_count = 3
        elif i % 3 == 0:
            block_class = "medium-story"
            col_count = 2
        else:
            block_class = "standard-story"
            col_count = 1
            
        img_html = f'<img src="{img_url}" class="article-img" />' if img_url else ""
        
        articles_html += f"""
        <div class="article-block {block_class}">
            <h2 class="article-headline">{headline}</h2>
            <div class="article-body" style="column-count: {col_count};">
                {img_html}
                <p>{content}</p>
            </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Telugu:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page {{ size: A3; margin: 10mm; }}
        body {{
            background: #fff;
            color: #000;
            font-family: 'Noto Serif Telugu', serif;
            margin: 0;
            padding: 0;
        }}
        .page-wrapper {{
            width: 277mm;
            min-height: 400mm;
            padding: 5mm;
            box-sizing: border-box;
            page-break-after: always;
            position: relative;
        }}
        
        /* Masthead Styles */
        .masthead {{
            border: 2px solid #000;
            margin-bottom: 15px;
        }}
        .masthead-top {{
            display: flex;
            justify-content: space-between;
            background: #006600;
            color: #fff;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: bold;
        }}
        .masthead-logo {{
            text-align: center;
            padding: 10px;
            background: #fff;
        }}
        .masthead-logo img {{
            height: 90px;
        }}
        .masthead-info {{
            display: flex;
            justify-content: space-between;
            background: #006600;
            color: #fff;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: bold;
        }}
        
        /* Layout */
        .newspaper-grid {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-content: flex-start;
        }}
        
        /* Article Blocks */
        .article-block {{
            border: 1px solid #ccc;
            padding: 8px;
            box-sizing: border-box;
            background: #fff;
            break-inside: avoid;
            margin-bottom: 5px;
        }}
        .lead-story {{
            width: 100%;
            border: 2px solid #cc0000;
        }}
        .feature-story {{
            width: 100%;
            border-top: 3px solid #0000cc;
        }}
        .medium-story {{
            width: calc(50% - 5px);
        }}
        .standard-story {{
            width: calc(25% - 7.5px);
        }}
        
        /* Typography inside articles */
        .article-headline {{
            margin: 0 0 8px 0;
            font-size: 22px;
            font-weight: 800;
            line-height: 1.2;
            color: #111;
            text-align: center;
        }}
        .lead-story .article-headline {{ font-size: 32px; color: #cc0000; }}
        .feature-story .article-headline {{ font-size: 26px; color: #0000cc; }}
        
        .article-body {{
            column-gap: 15px;
            text-align: justify;
            font-size: 11px;
            line-height: 1.5;
        }}
        .article-img {{
            width: 100%;
            margin-bottom: 8px;
            border: 1px solid #eee;
            break-inside: avoid;
        }}
        p {{
            margin: 0 0 10px 0;
            text-indent: 15px;
        }}
    </style>
</head>
<body>
    <div class="page-wrapper">
        {header_html}
        <div class="newspaper-grid">
            {articles_html}
        </div>
    </div>
</body>
</html>
"""
    return html

# Generate mock data
mock_articles = [
    {
        "headline": "కీలక నిర్ణయాలకు కేంద్ర క్యాబినెట్ ఆమోదం",
        "content": ("ముఖ్యమైన నిర్ణయాలు తీసుకున్న కేంద్ర మంత్రిమండలి... " * 15),
        "image_url": "https://picsum.photos/400/250?random=1"
    },
    {
        "headline": "రైతు బజార్లలో కిలో ఉల్లి రూ. 35",
        "content": ("వినియోగదారులకు ఊరట... ఉల్లి ధరలు తగ్గుముఖం... " * 10),
        "image_url": "https://picsum.photos/400/250?random=2"
    },
    {
        "headline": "ఉద్యోగులకు నిరంతర నైపుణ్య శిక్షణ",
        "content": ("ఉద్యోగుల నైపుణ్యాలను మెరుగుపరచడానికి చర్యలు... " * 12),
        "image_url": "https://picsum.photos/400/250?random=3"
    },
    {
        "headline": "అవసరమైన న్యాయ సాయం పార్టీ నుంచి",
        "content": ("కార్యకర్తలకు పూర్తి మద్దతు ఉంటుంది అని ప్రకటన... " * 8),
        "image_url": "https://picsum.photos/400/250?random=4"
    },
    {
        "headline": "టెస్ట్ న్యూస్ 1",
        "content": ("వివరాలు ఇక్కడ ఉన్నాయి... " * 20),
        "image_url": ""
    },
    {
        "headline": "టెస్ట్ న్యూస్ 2",
        "content": ("మరిన్ని వివరాలు త్వరలో... " * 20),
        "image_url": ""
    },
    {
        "headline": "టెస్ట్ న్యూస్ 3",
        "content": ("అద్భుతమైన వార్త... " * 20),
        "image_url": ""
    }
]

html_out = generate_newspaper_page(mock_articles, 1, 4, "శనివారం - 03 అక్టోబర్ - 2026")

with open("test_layout.html", "w", encoding="utf-8") as f:
    f.write(html_out)

print("Generated test_layout.html")
