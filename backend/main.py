from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
import pandas as pd
import numpy as np
import scipy.stats as stats
import io
import io as io_module

app = FastAPI(title="StatViz API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe_val(v):
    """Convert numpy types and NaN to JSON-safe values."""
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    return v


def analyze_column(series: pd.Series):
    """Run full statistical analysis on a single column."""
    result = {
        "name": series.name,
        "dtype": str(series.dtype),
        "count": int(series.count()),
        "missing": int(series.isnull().sum()),
        "missing_pct": round(series.isnull().mean() * 100, 2),
        "unique": int(series.nunique()),
    }

    if pd.api.types.is_numeric_dtype(series):
        clean = series.dropna()
        result["type"] = "numeric"
        result["mean"] = safe_val(clean.mean())
        result["median"] = safe_val(clean.median())
        result["std"] = safe_val(clean.std())
        result["variance"] = safe_val(clean.var())
        result["min"] = safe_val(clean.min())
        result["max"] = safe_val(clean.max())
        result["q1"] = safe_val(clean.quantile(0.25))
        result["q3"] = safe_val(clean.quantile(0.75))
        result["iqr"] = safe_val(clean.quantile(0.75) - clean.quantile(0.25))
        result["skewness"] = safe_val(clean.skew())
        result["kurtosis"] = safe_val(clean.kurtosis())
        result["range"] = safe_val(clean.max() - clean.min())

        # Outlier detection using IQR
        q1, q3 = clean.quantile(0.25), clean.quantile(0.75)
        iqr = q3 - q1
        outliers = clean[(clean < q1 - 1.5 * iqr) | (clean > q3 + 1.5 * iqr)]
        result["outliers_count"] = int(len(outliers))

        # Normality test (Shapiro-Wilk, max 5000 samples)
        sample = clean.sample(min(len(clean), 5000), random_state=42)
        if len(sample) >= 3:
            stat, p = stats.shapiro(sample)
            result["normality_stat"] = safe_val(stat)
            result["normality_p"] = safe_val(p)
            result["is_normal"] = bool(p > 0.05)

        # Histogram bins
        counts, bin_edges = np.histogram(clean, bins=10)
        result["histogram"] = {
            "counts": counts.tolist(),
            "bins": [round(float(e), 2) for e in bin_edges],
        }

    else:
        result["type"] = "categorical"
        vc = series.value_counts()
        result["top_values"] = {
            str(k): int(v) for k, v in vc.head(10).items()
        }
        result["mode"] = str(series.mode().iloc[0]) if not series.mode().empty else None

    return result


def compute_correlation(df: pd.DataFrame):
    """Pearson correlation matrix for numeric columns."""
    numeric = df.select_dtypes(include=[np.number])
    if numeric.shape[1] < 2:
        return None
    corr = numeric.corr().round(3)
    return {
        "columns": list(corr.columns),
        "matrix": corr.values.tolist(),
    }


@app.get("/")
def root():
    return {"status": "StatViz API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a CSV or Excel file and get full EDA results.
    Returns: dataset info, per-column stats, correlation matrix.
    """
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and Excel files are supported."
        )

    content = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(df) > 100_000:
        raise HTTPException(status_code=400, detail="File too large. Max 100,000 rows.")

    columns_analysis = [analyze_column(df[col]) for col in df.columns]
    correlation = compute_correlation(df)

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    return {
        "filename": file.filename,
        "rows": len(df),
        "columns_count": len(df.columns),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "total_missing": int(df.isnull().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "columns": columns_analysis,
        "correlation": correlation,
        "preview": df.head(5).fillna("").astype(str).to_dict(orient="records"),
    }


@app.post("/export/pdf")
async def export_pdf(data: dict):
    buffer = io_module.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm)

    title_style = ParagraphStyle('title', fontSize=20, fontName='Helvetica-Bold', textColor=colors.HexColor('#185fa5'), spaceAfter=6)
    heading_style = ParagraphStyle('heading', fontSize=13, fontName='Helvetica-Bold', textColor=colors.HexColor('#2c2c2a'), spaceBefore=14, spaceAfter=6)
    normal_style = ParagraphStyle('normal', fontSize=10, fontName='Helvetica', textColor=colors.HexColor('#444441'), spaceAfter=4)

    story = []

    # Title
    story.append(Paragraph("StatViz — Analysis Report", title_style))
    story.append(Paragraph(f"File: {data.get('filename', 'Unknown')}", normal_style))
    story.append(Paragraph(f"Rows: {data.get('rows', 0)}  |  Columns: {data.get('columns_count', 0)}  |  Missing values: {data.get('total_missing', 0)}  |  Duplicates: {data.get('duplicate_rows', 0)}", normal_style))
    story.append(Spacer(1, 0.4*cm))

    # Numeric summary table
    num_cols = [c for c in data.get('columns', []) if c.get('type') == 'numeric']
    if num_cols:
        story.append(Paragraph("Numeric Columns Summary", heading_style))
        table_data = [["Column", "Mean", "Median", "Std Dev", "Min", "Max", "Outliers"]]
        for col in num_cols:
            table_data.append([
                col.get('name', ''),
                f"{col.get('mean', 0):.2f}" if col.get('mean') is not None else "—",
                f"{col.get('median', 0):.2f}" if col.get('median') is not None else "—",
                f"{col.get('std', 0):.2f}" if col.get('std') is not None else "—",
                f"{col.get('min', 0):.2f}" if col.get('min') is not None else "—",
                f"{col.get('max', 0):.2f}" if col.get('max') is not None else "—",
                str(col.get('outliers_count', 0)),
            ])
        t = Table(table_data, colWidths=[3.5*cm, 2*cm, 2*cm, 2*cm, 2*cm, 2*cm, 2*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#185fa5')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f7f6f1'), colors.white]),
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e0d8')),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t)

    # Categorical summary
    cat_cols = [c for c in data.get('columns', []) if c.get('type') == 'categorical']
    if cat_cols:
        story.append(Paragraph("Categorical Columns Summary", heading_style))
        for col in cat_cols:
            story.append(Paragraph(f"<b>{col.get('name')}</b> — {col.get('unique')} unique values", normal_style))
            top = col.get('top_values', {})
            for val, count in list(top.items())[:5]:
                story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;• {val}: {count}", normal_style))

    # Correlation
    corr = data.get('correlation')
    if corr:
        story.append(Paragraph("Correlation Matrix", heading_style))
        cols_list = corr.get('columns', [])
        matrix = corr.get('matrix', [])
        corr_data = [[""] + cols_list]
        for i, row in enumerate(matrix):
            corr_data.append([cols_list[i]] + [f"{v:.2f}" if v is not None else "—" for v in row])
        ct = Table(corr_data)
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#185fa5')),
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#185fa5')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('TEXTCOLOR', (0,0), (0,-1), colors.white),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e0d8')),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        story.append(ct)

    doc.build(story)
    buffer.seek(0)

    filename = data.get('filename', 'report').replace('.csv','').replace('.xlsx','')
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=statviz_{filename}_report.pdf"}
    )