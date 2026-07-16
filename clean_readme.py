import re

def clean_readme():
    with open('README.md', encoding='utf-8') as f:
        text = f.read()

    # Split the text by the JavaScript object separator
    parts = re.split(r'`\s*},\s*\{\s*id:\s*"[^"]*",\s*title:\s*"[^"]*",\s*content:\s*`', text)
    
    clean_parts = []
    for part in parts:
        # Remove any trailing JavaScript array closing syntax
        part = re.sub(r'`\s*\}\s*\];?\s*$', '', part)
        
        # Remove any leading JavaScript array opening syntax if present
        part = re.sub(r'^export const [a-zA-Z_0-9]+ = \[\s*\{\s*id:\s*"[^"]*",\s*title:\s*"[^"]*",\s*content:\s*`', '', part)
        
        clean_parts.append(part.strip())

    new_text = '\n\n'.join(clean_parts)
    
    with open('README.md', 'w', encoding='utf-8') as f:
        f.write(new_text)
    
    print("Cleaned README successfully")

if __name__ == '__main__':
    clean_readme()
