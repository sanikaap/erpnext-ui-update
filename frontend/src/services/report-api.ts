// src/services/report-api.ts

import {
    erpnextApi,
} from "./erpnext-api";


export interface ReportOptions {
    filters?: Record<string, any>;

    limit?: number;

    limitStart?: number;
}


export const reportApi = {

    // Run report
    run<T = any>(
        reportName: string,
        options: ReportOptions = {}
    ) {

        const params = new URLSearchParams();

        params.set(
            "report_name",
            reportName
        );

        params.set(
            "filters",
            JSON.stringify(
                options.filters || {}
            )
        );

        params.set(
            "limit_page_length",
            String(
                options.limit ?? 100
            )
        );

        params.set(
            "limit_start",
            String(
                options.limitStart ?? 0
            )
        );


        return erpnextApi.callPost<T>(
            "frappe.desk.query_report.run",
            {
                report_name:
                    reportName,

                filters:
                    options.filters || {},

                limit_page_length:
                    options.limit ?? 100,

                limit_start:
                    options.limitStart ?? 0,
            }
        );
    },


    // Get report directly
    get(
        reportName: string
    ) {

        return erpnextApi.getDoc(
            "Report",
            reportName
        );
    },


    // List reports
    list() {

        return erpnextApi.getList(
            "Report",
            {
                fields: [
                    "name",
                    "report_name",
                    "ref_doctype",
                    "report_type",
                    "is_standard",
                ],

                limit: 100,
            }
        );
    },
};


export default reportApi;