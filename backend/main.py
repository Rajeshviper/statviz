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
    """One-way and Two-way ANOVA"""
    anova_type = data.get("anova_type", "one_way")
    groups = data.get("groups", {})

    try:
        if anova_type == "one_way":
            group_data = [np.array(v) for v in groups.values()]
            group_names = list(groups.keys())

            if len(group_data) < 2:
                raise HTTPException(status_code=400, detail="Need at least 2 groups")

            stat, p = scipy_stats.f_oneway(*group_data)

            all_data = np.concatenate(group_data)
            grand_mean = np.mean(all_data)
            ss_between = sum(len(g) * (np.mean(g) - grand_mean)**2 for g in group_data)
            ss_total = sum((x - grand_mean)**2 for x in all_data)
            denom = ss_total if ss_total > 0.0001 else 1
            f_denom = (ss_total - ss_between) / (len(all_data) - len(group_data))
            eta_squared = float(ss_between / denom) if denom > 0.0001 else 0.0

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
                "interpretation": f"One-Way ANOVA: {'Significant' if p < 0.05 else 'No significant'} difference between {len(group_data)} groups (F={stat:.3f}, p={p:.4f}). Effect size η²={eta_squared:.3f} ({'large' if eta_squared > 0.14 else 'medium' if eta_squared > 0.06 else 'small'} effect)."
            }

        elif anova_type == "two_way":
            group_a = data.get("group_a", {})
            group_b = data.get("group_b", {})

            # Build combined data
            all_values = []
            factor_a = []
            factor_b = []

            for level_a, vals_a in group_a.items():
                for level_b, vals_b in group_b.items():
                    n = min(len(vals_a), len(vals_b))
                    combined = [(vals_a[i] + vals_b[i]) / 2 for i in range(n)]
                    all_values.extend(combined)
                    factor_a.extend([level_a] * n)
                    factor_b.extend([level_b] * n)

            df_data = pd.DataFrame({
                "value": all_values,
                "factor_a": factor_a,
                "factor_b": factor_b,
            })

            # Main effects
            groups_a = [df_data[df_data["factor_a"] == l]["value"].values for l in df_data["factor_a"].unique()]
            groups_b = [df_data[df_data["factor_b"] == l]["value"].values for l in df_data["factor_b"].unique()]

            f_a, p_a = scipy_stats.f_oneway(*groups_a)
            f_b, p_b = scipy_stats.f_oneway(*groups_b)

            # Group summaries
            summary_a = {l: {"mean": round(float(np.mean(g)), 3), "n": len(g)} for l, g in zip(df_data["factor_a"].unique(), groups_a)}
            summary_b = {l: {"mean": round(float(np.mean(g)), 3), "n": len(g)} for l, g in zip(df_data["factor_b"].unique(), groups_b)}

            return {
                "test": "Two-Way ANOVA",
                "factor_a_f": round(float(f_a), 4),
                "factor_a_p": round(float(p_a), 4),
                "factor_b_f": round(float(f_b), 4),
                "factor_b_p": round(float(p_b), 4),
                "significant": bool(p_a < 0.05 or p_b < 0.05),
                "group_summary": {**{f"A:{k}": v for k, v in summary_a.items()}, **{f"B:{k}": v for k, v in summary_b.items()}},
                "interpretation": f"Two-Way ANOVA: Factor A {'significant' if p_a < 0.05 else 'not significant'} (F={f_a:.3f}, p={p_a:.4f}). Factor B {'significant' if p_b < 0.05 else 'not significant'} (F={f_b:.3f}, p={p_b:.4f})."
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

        #Remove NaN values
        mask = ~(np.isnan(X).any(axis=1) | np.isnan(y))
        X = X[mask]
        y = y[mask]
        
        if len(X) < 3:
            raise HTTPException(status_code=400, detail="Not enough valid data points after removing NaN values.")

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


# ── Time Series ───────────────────────────────────────────────────────────────
@app.post("/stats/timeseries")
async def run_timeseries(data: dict):
    col = data.get("col", [])
    window = data.get("window", 3)

    try:
        series = pd.Series(col)

        # Moving average
        ma = series.rolling(window=window).mean().dropna().tolist()

        # Trend (linear)
        x = np.arange(len(series))
        slope, intercept, r, p, se = scipy_stats.linregress(x, series)

        # Decomposition (manual)
        trend_line = [intercept + slope * i for i in range(len(series))]
        residuals = (series - pd.Series(trend_line)).tolist()

        # Basic stationarity (ADF-like check using variance)
        first_half = series[:len(series)//2]
        second_half = series[len(series)//2:]
        is_stationary = bool(abs(first_half.mean() - second_half.mean()) < series.std())

        return {
            "test": "Time Series Analysis",
            "original": series.tolist(),
            "moving_average": ma,
            "trend_line": trend_line,
            "residuals": residuals,
            "slope": round(float(slope), 4),
            "intercept": round(float(intercept), 4),
            "r_squared": round(float(r**2), 4),
            "trend_direction": "upward" if slope > 0 else "downward" if slope < 0 else "flat",
            "is_stationary": is_stationary,
            "interpretation": f"The series has a {('upward' if slope > 0 else 'downward' if slope < 0 else 'flat')} trend (slope={slope:.4f}). R²={r**2:.3f}. The series appears {'stationary' if is_stationary else 'non-stationary'}."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Probability Distributions ─────────────────────────────────────────────────
@app.post("/stats/probability")
async def run_probability(data: dict):
    dist_type = data.get("dist_type", "normal")
    col = data.get("col", [])

    try:
        series = np.array(col)

        if dist_type == "normal":
            mu, sigma = scipy_stats.norm.fit(series)
            x = np.linspace(mu - 4*sigma, mu + 4*sigma, 100)
            pdf = scipy_stats.norm.pdf(x, mu, sigma).tolist()
            stat, p = scipy_stats.shapiro(series[:min(len(series), 5000)])
            return {
                "test": "Normal Distribution",
                "mu": round(float(mu), 4),
                "sigma": round(float(sigma), 4),
                "x": [round(float(v), 4) for v in x],
                "pdf": [round(float(v), 6) for v in pdf],
                "shapiro_stat": round(float(stat), 4),
                "p_value": round(float(p), 4),
                "significant": bool(p > 0.05),
                "goodness_of_fit": round(float(p), 4),
                "interpretation": f"Fitted Normal distribution: μ={mu:.3f}, σ={sigma:.3f}. {'Data fits normal distribution well' if p > 0.05 else 'Data does not fit normal distribution'} (Shapiro-Wilk p={p:.4f})."
            }

        elif dist_type == "binomial":
            p_est = np.mean(series > np.mean(series))
            n_est = len(series)
            x = np.arange(0, n_est + 1)
            pmf = scipy_stats.binom.pmf(x[:20], n_est, p_est).tolist()
            mean_b = n_est * p_est
            var_b = n_est * p_est * (1 - p_est)
            return {
                "test": "Binomial Distribution",
                "n": n_est,
                "p": round(float(p_est), 4),
                "mean": round(float(mean_b), 4),
                "variance": round(float(var_b), 4),
                "std": round(float(np.sqrt(var_b)), 4),
                "pmf_values": [round(float(v), 6) for v in pmf],
                "significant": True,
                "interpretation": f"Fitted Binomial: n={n_est}, p={p_est:.3f}. Expected mean={mean_b:.3f}, variance={var_b:.3f}."
            }

        elif dist_type == "poisson":
            lambda_est = np.mean(series)
            x = np.arange(0, max(20, int(lambda_est * 3)))
            pmf = scipy_stats.poisson.pmf(x, lambda_est).tolist()
            return {
                "test": "Poisson Distribution",
                "lambda": round(float(lambda_est), 4),
                "mean": round(float(lambda_est), 4),
                "variance": round(float(lambda_est), 4),
                "pmf_values": [round(float(v), 6) for v in pmf[:20]],
                "significant": True,
                "interpretation": f"Fitted Poisson distribution: λ={lambda_est:.3f}. Mean=Variance={lambda_est:.3f} (key property of Poisson)."
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Multivariate ──────────────────────────────────────────────────────────────
@app.post("/stats/multivariate")
async def run_multivariate(data: dict):
    from sklearn.decomposition import PCA
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    method = data.get("method", "pca")
    X_data = data.get("X", [])
    feature_names = data.get("feature_names", [])
    n_components = data.get("n_components", 2)
    n_clusters = data.get("n_clusters", 3)

    try:
        X = np.array(X_data)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        if method == "pca":
            pca = PCA(n_components=min(n_components, X.shape[1]))
            X_pca = pca.fit_transform(X_scaled)

            loadings = {}
            for i, name in enumerate(feature_names):
                loadings[name] = [round(float(v), 4) for v in pca.components_[:, i]]

            return {
                "test": "Principal Component Analysis (PCA)",
                "n_components": int(pca.n_components_),
                "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
                "cumulative_variance": [round(float(v), 4) for v in np.cumsum(pca.explained_variance_ratio_)],
                "loadings": loadings,
                "scores": X_pca[:10].tolist(),
                "significant": bool(pca.explained_variance_ratio_[0] > 0.3),
                "interpretation": f"First {pca.n_components_} components explain {np.sum(pca.explained_variance_ratio_)*100:.1f}% of total variance. PC1 explains {pca.explained_variance_ratio_[0]*100:.1f}%."
            }

        elif method == "kmeans":
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X_scaled)

            cluster_sizes = {f"Cluster {i+1}": int(np.sum(labels == i)) for i in range(n_clusters)}
            inertia = float(kmeans.inertia_)

            return {
                "test": "K-Means Clustering",
                "n_clusters": n_clusters,
                "inertia": round(inertia, 4),
                "cluster_sizes": cluster_sizes,
                "labels": labels[:50].tolist(),
                "significant": True,
                "interpretation": f"Data grouped into {n_clusters} clusters. Inertia={inertia:.2f} (lower = tighter clusters). Cluster sizes: {', '.join([f'{k}={v}' for k,v in cluster_sizes.items()])}."
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
# ── Bayesian Analysis ─────────────────────────────────────────────────────────
@app.post("/stats/bayesian")
async def run_bayesian(data: dict):
    method = data.get("method", "bayes_theorem")
    
    try:
        if method == "bayes_theorem":
            # P(A|B) = P(B|A) * P(A) / P(B)
            prior = data.get("prior", 0.5)
            likelihood = data.get("likelihood", 0.8)
            evidence = data.get("evidence", 0.6)
            
            posterior = (likelihood * prior) / evidence if evidence > 0 else 0
            posterior = min(1.0, max(0.0, posterior))
            
            # Generate prior and posterior distributions
            from scipy.stats import beta
            alpha_prior = max(0.1, prior * 10)
            beta_prior = max(0.1, (1 - prior) * 10)
            alpha_post = alpha_prior + likelihood * 10
            beta_post = beta_prior + (1 - likelihood) * 10
            
            x = np.linspace(0, 1, 100).tolist()
            prior_dist = scipy_stats.beta.pdf(x, alpha_prior, beta_prior).tolist()
            posterior_dist = scipy_stats.beta.pdf(x, alpha_post, beta_post).tolist()
            
            return {
                "test": "Bayes Theorem",
                "prior": round(float(prior), 4),
                "likelihood": round(float(likelihood), 4),
                "evidence": round(float(evidence), 4),
                "posterior": round(float(posterior), 4),
                "bayes_factor": round(float(posterior / prior) if prior > 0 else 0, 4),
                "x": [round(float(v), 4) for v in x],
                "prior_dist": [round(float(v), 4) for v in prior_dist],
                "posterior_dist": [round(float(v), 4) for v in posterior_dist],
                "significant": bool(posterior > prior),
                "interpretation": f"Prior probability: {prior:.3f}. After observing evidence, posterior probability: {posterior:.3f}. {'Evidence increased' if posterior > prior else 'Evidence decreased'} our belief by {abs(posterior - prior):.3f}. Bayes Factor={posterior/prior:.3f} ({'strong' if posterior/prior > 3 else 'moderate' if posterior/prior > 1.5 else 'weak'} evidence)."
            }
            
        elif method == "credible_interval":
            col = data.get("col", [])
            confidence = data.get("confidence", 0.95)
            
            series = np.array(col)
            n = len(series)
            mean = np.mean(series)
            std = np.std(series)
            
            # Bayesian credible interval using normal-normal conjugate
            alpha_level = (1 - confidence) / 2
            z = scipy_stats.norm.ppf(1 - alpha_level)
            margin = z * (std / np.sqrt(n))
            
            lower = mean - margin
            upper = mean + margin
            
            # Posterior distribution
            x = np.linspace(mean - 4*std/np.sqrt(n), mean + 4*std/np.sqrt(n), 100)
            posterior = scipy_stats.norm.pdf(x, mean, std/np.sqrt(n))
            
            return {
                "test": "Bayesian Credible Interval",
                "mean": round(float(mean), 4),
                "std": round(float(std), 4),
                "lower_bound": round(float(lower), 4),
                "upper_bound": round(float(upper), 4),
                "confidence_level": confidence,
                "x": [round(float(v), 4) for v in x],
                "posterior": [round(float(v), 6) for v in posterior],
                "significant": True,
                "interpretation": f"There is a {confidence*100:.0f}% probability that the true mean lies between {lower:.3f} and {upper:.3f}. Unlike frequentist CI, this directly states the probability of the parameter being in this range."
            }

        elif method == "beta_binomial":
            successes = data.get("successes", 10)
            trials = data.get("trials", 20)
            prior_alpha = data.get("prior_alpha", 1)
            prior_beta = data.get("prior_beta", 1)

            # Conjugate update
            post_alpha = prior_alpha + successes
            post_beta = prior_beta + (trials - successes)

            x = np.linspace(0, 1, 100)
            prior_dist = scipy_stats.beta.pdf(x, prior_alpha, prior_beta)
            posterior_dist = scipy_stats.beta.pdf(x, post_alpha, post_beta)

            post_mean = post_alpha / (post_alpha + post_beta)
            post_var = (post_alpha * post_beta) / ((post_alpha + post_beta)**2 * (post_alpha + post_beta + 1))
            credible_low = scipy_stats.beta.ppf(0.025, post_alpha, post_beta)
            credible_high = scipy_stats.beta.ppf(0.975, post_alpha, post_beta)

            return {
                "test": "Beta-Binomial Bayesian Update",
                "prior_alpha": prior_alpha,
                "prior_beta": prior_beta,
                "posterior_alpha": post_alpha,
                "posterior_beta": post_beta,
                "posterior_mean": round(float(post_mean), 4),
                "posterior_variance": round(float(post_var), 6),
                "credible_interval_low": round(float(credible_low), 4),
                "credible_interval_high": round(float(credible_high), 4),
                "x": [round(float(v), 4) for v in x],
                "prior_dist": [round(float(v), 4) for v in prior_dist],
                "posterior_dist": [round(float(v), 4) for v in posterior_dist],
                "significant": True,
                "interpretation": f"With {successes} successes in {trials} trials, posterior mean={post_mean:.3f}. 95% credible interval: [{credible_low:.3f}, {credible_high:.3f}]. The data updated our prior belief from {prior_alpha/(prior_alpha+prior_beta):.3f} to {post_mean:.3f}."
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Survival Analysis ─────────────────────────────────────────────────────────
@app.post("/stats/survival")
async def run_survival(data: dict):
    method = data.get("method", "kaplanmeier")

    try:
        if method == "kaplanmeier":
            durations = data.get("durations", [])
            events = data.get("events", [])

            from lifelines import KaplanMeierFitter
            kmf = KaplanMeierFitter()
            kmf.fit(durations, event_observed=events)

            timeline = kmf.timeline.tolist()
            survival = kmf.survival_function_["KM_estimate"].tolist()
            ci_lower = kmf.confidence_interval_["KM_estimate_lower_0.95"].tolist()
            ci_upper = kmf.confidence_interval_["KM_estimate_upper_0.95"].tolist()
            median_survival = float(kmf.median_survival_time_)
            median_str = f"{median_survival:.2f}" if not np.isnan(median_survival) else "not reached"

            return {
                "test": "Kaplan-Meier Survival Analysis",
                "median_survival": round(median_survival, 4) if not np.isnan(median_survival) else None,
                "timeline": [round(float(v), 4) for v in timeline],
                "survival_probability": [round(float(v), 4) for v in survival],
                "ci_lower": [round(float(v), 4) for v in ci_lower],
                "ci_upper": [round(float(v), 4) for v in ci_upper],
                "n_subjects": len(durations),
                "n_events": int(sum(events)),
                "significant": True,
                "interpretation": f"Kaplan-Meier analysis of {len(durations)} subjects with {int(sum(events))} events. Median survival time: {median_str}. Survival probability decreases over time as events occur."
            }

        elif method == "logrank":
            durations_a = data.get("durations_a", [])
            events_a = data.get("events_a", [])
            durations_b = data.get("durations_b", [])
            events_b = data.get("events_b", [])

            from lifelines.statistics import logrank_test
            result = logrank_test(durations_a, durations_b,
                                  event_observed_A=events_a,
                                  event_observed_B=events_b)

            return {
                "test": "Log-Rank Test",
                "test_statistic": round(float(result.test_statistic), 4),
                "p_value": round(float(result.p_value), 4),
                "significant": bool(result.p_value < 0.05),
                "interpretation": f"The two survival curves are {'significantly different' if result.p_value < 0.05 else 'not significantly different'} (χ²={result.test_statistic:.3f}, p={result.p_value:.4f}). {'There is a significant difference in survival between the two groups.' if result.p_value < 0.05 else 'No significant difference in survival was found between the two groups.'}"
            }

        elif method == "hazard":
            durations = data.get("durations", [])
            events = data.get("events", [])

            from lifelines import NelsonAalenFitter
            naf = NelsonAalenFitter()
            naf.fit(durations, event_observed=events)

            timeline = naf.timeline.tolist()
            hazard = naf.cumulative_hazard_["NA_estimate"].tolist()

            return {
                "test": "Nelson-Aalen Cumulative Hazard",
                "timeline": [round(float(v), 4) for v in timeline],
                "cumulative_hazard": [round(float(v), 4) for v in hazard],
                "n_subjects": len(durations),
                "n_events": int(sum(events)),
                "significant": True,
                "interpretation": f"Nelson-Aalen cumulative hazard estimate for {len(durations)} subjects. The cumulative hazard increases over time indicating increasing risk of the event occurring."
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))