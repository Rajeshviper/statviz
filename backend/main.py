from scipy import stats as scipy_stats
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
import httpx

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


@app.post("/ai/insights")
async def ai_insights(data: dict):
    # Build a summary of the dataset for Claude
    filename = data.get("filename", "dataset")
    rows = data.get("rows", 0)
    columns = data.get("columns", [])

    num_cols = [c for c in columns if c.get("type") == "numeric"]
    cat_cols = [c for c in columns if c.get("type") == "categorical"]

    # Build stats summary text
    stats_summary = f"Dataset: {filename}\nRows: {rows}\n\n"
    stats_summary += "Numeric columns:\n"
    for col in num_cols:
        stats_summary += f"- {col['name']}: mean={col.get('mean', 0):.2f}, std={col.get('std', 0):.2f}, min={col.get('min', 0):.2f}, max={col.get('max', 0):.2f}, outliers={col.get('outliers_count', 0)}, normal={col.get('is_normal', False)}\n"

    stats_summary += "\nCategorical columns:\n"
    for col in cat_cols:
        top = col.get("top_values", {})
        top_str = ", ".join([f"{k}({v})" for k, v in list(top.items())[:3]])
        stats_summary += f"- {col['name']}: {col.get('unique', 0)} unique values, top: {top_str}\n"

    corr = data.get("correlation")
    if corr:
        cols_list = corr.get("columns", [])
        matrix = corr.get("matrix", [])
        stats_summary += "\nStrong correlations (>0.7):\n"
        for i, row in enumerate(matrix):
            for j, val in enumerate(row):
                if i < j and val is not None and abs(val) > 0.7:
                    stats_summary += f"- {cols_list[i]} & {cols_list[j]}: {val:.2f}\n"

    # Call Claude API
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {data.get('api_key', '')}",
                "content-type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": f"""You are a data analyst. Analyse this dataset and give 5 clear, specific insights in simple English. Focus on patterns, outliers, correlations and what the data tells us. Be concise and helpful.

{stats_summary}

Give exactly 5 insights as a numbered list. Each insight should be 1-2 sentences."""
                    }
                ]
            }
        )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Groq API error: {response.text}")

    result = response.json()
    insights = result["choices"][0]["message"]["content"]
    return {"insights": insights}

from scipy import stats as scipy_stats

@app.post("/stats/ttest")
async def run_ttest(data: dict):
    """One-sample, two-sample and paired t-test"""
    test_type = data.get("test_type", "one_sample")
    col1 = data.get("col1", [])
    col2 = data.get("col2", [])
    pop_mean = data.get("pop_mean", 0)

    try:
        if test_type == "one_sample":
            stat, p = scipy_stats.ttest_1samp(col1, pop_mean)
            df = len(col1) - 1
            result = {
                "test": "One-Sample T-Test",
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "degrees_of_freedom": df,
                "significant": bool(p < 0.05),
                "interpretation": f"The mean is {'significantly different from' if p < 0.05 else 'not significantly different from'} {pop_mean} (t={stat:.3f}, p={p:.4f})"
            }
        elif test_type == "two_sample":
            stat, p = scipy_stats.ttest_ind(col1, col2)
            df = len(col1) + len(col2) - 2
            result = {
                "test": "Two-Sample Independent T-Test",
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "degrees_of_freedom": df,
                "significant": bool(p < 0.05),
                "mean1": round(float(np.mean(col1)), 4),
                "mean2": round(float(np.mean(col2)), 4),
                "interpretation": f"The two groups are {'significantly different' if p < 0.05 else 'not significantly different'} (t={stat:.3f}, p={p:.4f})"
            }
        elif test_type == "paired":
            stat, p = scipy_stats.ttest_rel(col1, col2)
            result = {
                "test": "Paired T-Test",
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "significant": bool(p < 0.05),
                "mean_difference": round(float(np.mean(np.array(col1) - np.array(col2))), 4),
                "interpretation": f"The paired difference is {'significant' if p < 0.05 else 'not significant'} (t={stat:.3f}, p={p:.4f})"
            }
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/stats/anova")
async def run_anova(data: dict):
    """One-way ANOVA with post-hoc Tukey test"""
    groups = data.get("groups", {})

    try:
        group_data = [np.array(v) for v in groups.values()]
        group_names = list(groups.keys())

        if len(group_data) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 groups")

        stat, p = scipy_stats.f_oneway(*group_data)

        # Effect size (eta squared)
        all_data = np.concatenate(group_data)
        grand_mean = np.mean(all_data)
        ss_between = sum(len(g) * (np.mean(g) - grand_mean)**2 for g in group_data)
        ss_total = sum((x - grand_mean)**2 for x in all_data)
        eta_squared = float(ss_between / ss_total) if ss_total > 0.0001 else 0.0

        # Group summaries
        group_summary = {}
        for name, gdata in zip(group_names, group_data):
            group_summary[name] = {
                "mean": round(float(np.mean(gdata)), 3),
                "std": round(float(np.std(gdata)), 3),
                "n": len(gdata)
            }

        return {
            "test": "One-Way ANOVA",
            "f_statistic": round(float(stat), 4),
            "p_value": round(float(p), 4),
            "eta_squared": round(float(eta_squared), 4),
            "significant": bool(p < 0.05),
            "group_summary": group_summary,
            "interpretation": f"There is {'a significant' if p < 0.05 else 'no significant'} difference between groups (F={stat:.3f}, p={p:.4f}). Effect size η²={eta_squared:.3f} ({'large' if eta_squared > 0.14 else 'medium' if eta_squared > 0.06 else 'small'} effect)."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/stats/chisquare")
async def run_chisquare(data: dict):
    """Chi-square test of independence"""
    col1 = data.get("col1", [])
    col2 = data.get("col2", [])

    try:
        contingency = pd.crosstab(pd.Series(col1), pd.Series(col2))
        chi2, p, dof, expected = scipy_stats.chi2_contingency(contingency)

        # Cramer's V effect size
        n = len(col1)
        denom = n * (min(contingency.shape) - 1)
        cramers_v = np.sqrt(chi2 / denom) if denom > 0 else 0.0

        return {
            "test": "Chi-Square Test of Independence",
            "chi2_statistic": round(float(chi2), 4),
            "p_value": round(float(p), 4),
            "degrees_of_freedom": int(dof),
            "cramers_v": round(float(cramers_v), 4),
            "significant": bool(p < 0.05),
            "contingency_table": contingency.to_dict(),
            "interpretation": f"The two variables are {'significantly associated' if p < 0.05 else 'not significantly associated'} (χ²={chi2:.3f}, p={p:.4f}). Cramer's V={cramers_v:.3f} ({'strong' if cramers_v > 0.5 else 'moderate' if cramers_v > 0.3 else 'weak'} association)."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/stats/correlation")
async def run_correlation(data: dict):
    """Pearson, Spearman and Kendall correlation"""
    col1 = data.get("col1", [])
    col2 = data.get("col2", [])
    method = data.get("method", "pearson")

    try:
        if method == "pearson":
            stat, p = scipy_stats.pearsonr(col1, col2)
            test_name = "Pearson Correlation"
        elif method == "spearman":
            stat, p = scipy_stats.spearmanr(col1, col2)
            test_name = "Spearman Rank Correlation"
        elif method == "kendall":
            stat, p = scipy_stats.kendalltau(col1, col2)
            test_name = "Kendall Tau Correlation"

        strength = "very strong" if abs(stat) > 0.8 else "strong" if abs(stat) > 0.6 else "moderate" if abs(stat) > 0.4 else "weak" if abs(stat) > 0.2 else "very weak"
        direction = "positive" if stat > 0 else "negative"

        return {
            "test": test_name,
            "correlation": round(float(stat), 4),
            "p_value": round(float(p), 4),
            "significant": bool(p < 0.05),
            "interpretation": f"There is a {strength} {direction} correlation (r={stat:.3f}, p={p:.4f}). {'Statistically significant.' if p < 0.05 else 'Not statistically significant.'}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/stats/regression")
async def run_regression(data: dict):
    """Simple and multiple linear regression"""
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import r2_score, mean_squared_error

    X_data = data.get("X", [])
    y_data = data.get("y", [])
    feature_names = data.get("feature_names", [])

    try:
        X = np.array(X_data).reshape(-1, len(feature_names)) if len(feature_names) > 1 else np.array(X_data).reshape(-1, 1)
        y = np.array(y_data)

        model = LinearRegression()
        model.fit(X, y)
        y_pred = model.predict(X)

        r2 = r2_score(y, y_pred)
        mse = mean_squared_error(y, y_pred)
        rmse = np.sqrt(mse)

        # F-statistic
        n, k = X.shape
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        f_stat = ((ss_tot - ss_res) / k) / (ss_res / (n - k - 1)) if n > k + 1 else 0

        coefficients = {}
        for i, name in enumerate(feature_names):
            coefficients[name] = round(float(model.coef_[i]), 4)

        return {
            "test": "Linear Regression",
            "r_squared": round(float(r2), 4),
            "adjusted_r_squared": round(float(1 - (1 - r2) * (n - 1) / (n - k - 1)), 4),
            "rmse": round(float(rmse), 4),
            "f_statistic": round(float(f_stat), 4),
            "intercept": round(float(model.intercept_), 4),
            "coefficients": coefficients,
            "interpretation": f"The model explains {r2*100:.1f}% of variance (R²={r2:.3f}). RMSE={rmse:.3f}. {'Good fit.' if r2 > 0.7 else 'Moderate fit.' if r2 > 0.4 else 'Poor fit — consider other models.'}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/stats/nonparametric")
async def run_nonparametric(data: dict):
    """Mann-Whitney, Wilcoxon, Kruskal-Wallis tests"""
    test_type = data.get("test_type", "mannwhitney")
    col1 = data.get("col1", [])
    col2 = data.get("col2", [])
    groups = data.get("groups", {})

    try:
        if test_type == "mannwhitney":
            stat, p = scipy_stats.mannwhitneyu(col1, col2, alternative="two-sided")
            return {
                "test": "Mann-Whitney U Test",
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "significant": bool(p < 0.05),
                "interpretation": f"The two groups are {'significantly different' if p < 0.05 else 'not significantly different'} (U={stat:.3f}, p={p:.4f}). Use this instead of t-test when data is not normally distributed."
            }
        elif test_type == "wilcoxon":
            stat, p = scipy_stats.wilcoxon(col1, col2)
            return {
                "test": "Wilcoxon Signed-Rank Test",
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "significant": bool(p < 0.05),
                "interpretation": f"The paired difference is {'significant' if p < 0.05 else 'not significant'} (W={stat:.3f}, p={p:.4f}). Non-parametric alternative to paired t-test."
            }
        elif test_type == "kruskalwallis":
            group_data = [np.array(v) for v in groups.values()]
            stat, p = scipy_stats.kruskal(*group_data)
            return {
                "test": "Kruskal-Wallis Test",
                "statistic": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "significant": bool(p < 0.05),
                "interpretation": f"There is {'a significant' if p < 0.05 else 'no significant'} difference between groups (H={stat:.3f}, p={p:.4f}). Non-parametric alternative to one-way ANOVA."
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))