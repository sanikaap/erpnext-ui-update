// src/services/file-api.ts

import {
    API_BASE_URL,
    erpnextApi,
} from "./erpnext-api";


export const fileApi = {

    // ----------------------------------------------------------
    // Get files attached to document
    // ----------------------------------------------------------

    async list(
        doctype: string,
        docname: string
    ) {

        return erpnextApi.getList(
            "File",
            {
                filters: {
                    attached_to_doctype:
                        doctype,

                    attached_to_name:
                        docname,
                },

                fields: [
                    "name",
                    "file_name",
                    "file_url",
                    "is_private",
                    "file_size",
                    "creation",
                ],

                limit: 100,
            }
        );
    },


    // ----------------------------------------------------------
    // Upload file
    // ----------------------------------------------------------

    async upload(
        file: File,
        options: {
            doctype?: string;
            docname?: string;
            isPrivate?: boolean;
        } = {}
    ) {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );


        if (options.doctype) {

            formData.append(
                "doctype",
                options.doctype
            );
        }


        if (options.docname) {

            formData.append(
                "docname",
                options.docname
            );
        }


        formData.append(
            "is_private",
            options.isPrivate
                ? "1"
                : "0"
        );


        const response =
            await fetch(
                `${API_BASE_URL}/method/upload_file`,
                {
                    method: "POST",

                    credentials: "include",

                    body: formData,
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.message ||
                data?.exception ||
                "File upload failed"
            );
        }


        return data;
    },


    // ----------------------------------------------------------
    // Delete file
    // ----------------------------------------------------------

    delete(
        name: string
    ) {

        return erpnextApi.deleteDoc(
            "File",
            name
        );
    },


    // ----------------------------------------------------------
    // Get file URL
    // ----------------------------------------------------------

    getUrl(
        fileUrl: string
    ) {

        if (
            fileUrl.startsWith(
                "http://"
            ) ||
            fileUrl.startsWith(
                "https://"
            )
        ) {
            return fileUrl;
        }


        // In development /files and /private are proxied, so the session cookie applies.
        return import.meta.env.DEV
            ? fileUrl
            : `${erpnextApi.getBaseUrl().replace(/\/$/, "")}${fileUrl}`;
    },
};


export default fileApi;