# 🏙️ Atlas Demográfico del Distrito Metropolitano de Quito (DMQ)

Aplicación web interactiva que visualiza la dinámica poblacional de las parroquias urbanas y rurales del Distrito Metropolitano de Quito. Analiza la evolución intercensal (2010 - 2022) y presenta proyecciones poblacionales hasta el año 2035.

## 🚀 Características Principales

*   **Mapa Coroplético Interactivo:** Visualización de la densidad poblacional y la Tasa de Crecimiento Anual Compuesta (TCAC) por parroquia.
*   **Proyecciones Poblacionales:** Estimaciones para 2025, 2030 y 2035 utilizando el método de crecimiento exponencial por cohorte (sexo y grupo de edad).
*   **Panel de Control Dinámico:** 
    *   Filtros por área (Urbana/Rural) y año.
    *   Gráficos interactivos de evolución temporal y top 10 parroquias.
    *   Pirámide poblacional detallada por sexo y edad.
*   **Tabla de Datos Integrada:** Información completa, ordenable y con búsqueda en tiempo real.

## 📊 Fuentes de Datos

*   **Población:** Censos de Población y Vivienda 2010 y 2022 (INEC).
*   **Cartografía:** Límites político-administrativos (parroquias) actualizados al 2022.

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** HTML5, CSS3, JavaScript Vanilla.
*   **Mapas:** [Leaflet.js](https://leafletjs.com/)
*   **Gráficos:** [Chart.js](https://www.chartjs.org/)
*   **Pre-procesamiento de datos:** Python (openpyxl) para el cálculo de proyecciones y simplificación de GeoJSON.

## 📖 Metodología

Para las proyecciones se calculó la **Tasa de Crecimiento Anual Compuesta (TCAC)** intercensal (2010-2022) para cada cohorte específica (combinación de parroquia, sexo y grupo de edad). Posteriormente, se aplicó un modelo de crecimiento exponencial para estimar la población en los años objetivo.
