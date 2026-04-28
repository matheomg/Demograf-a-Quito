import pandas as pd
import json
import math
import os

excel_path = r"c:\Users\amoralesg\Desktop\GI\CENSO\replica de resultados\POBLACION 2010 Y 2022.xlsx"
df = pd.read_excel(excel_path)

# Columns indices:
# 0: COD.
# 1: PARROQUIA
# 2: GRUPO DE EDAD
# 3: TOTAL 2010
# 4: HOMBRES 2010
# 5: MUJERES 2010
# 6: TOTAL 2022
# 7: HOMBRES 2022
# 8: MUJERES 2022

data = {"parishes": {}}

# Group by code
for cod, group in df.groupby(df.columns[0]):
    parroquia_name = group.iloc[0, 1]
    
    # Calculate totals
    t_2010 = int(group.iloc[:, 3].sum())
    m_2010 = int(group.iloc[:, 4].sum())
    f_2010 = int(group.iloc[:, 5].sum())
    
    t_2022 = int(group.iloc[:, 6].sum())
    m_2022 = int(group.iloc[:, 7].sum())
    f_2022 = int(group.iloc[:, 8].sum())
    
    tcac = 0
    if t_2010 > 0 and t_2022 > 0:
        tcac = (math.pow(t_2022 / t_2010, 1 / 12) - 1) * 100
        
    pyramid_2010 = []
    pyramid_2022 = []
    
    for _, row in group.iterrows():
        age = row.iloc[2]
        if pd.isna(age): continue
        pyramid_2010.append({
            "age": str(age),
            "male": int(row.iloc[4]) if pd.notna(row.iloc[4]) else 0,
            "female": int(row.iloc[5]) if pd.notna(row.iloc[5]) else 0
        })
        pyramid_2022.append({
            "age": str(age),
            "male": int(row.iloc[7]) if pd.notna(row.iloc[7]) else 0,
            "female": int(row.iloc[8]) if pd.notna(row.iloc[8]) else 0
        })

    data["parishes"][str(cod)] = {
        "name": parroquia_name,
        "totals": {
            "2010": {"total": t_2010, "male": m_2010, "female": f_2010},
            "2022": {"total": t_2022, "male": m_2022, "female": f_2022}
        },
        "pyramid": {
            "2010": pyramid_2010,
            "2022": pyramid_2022
        },
        "tcac": round(tcac, 2)
    }

# Write output to JS file
output_path = r"c:\Users\amoralesg\Desktop\GI\CENSO\app_v2\data.js"
with open(output_path, "w", encoding="utf-8") as f:
    f.write("const DATA = " + json.dumps(data) + ";\n")

print(f"Data successfully generated at {output_path}")
