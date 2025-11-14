import React from "react";

const SqlOutputTable = ({ data }) => {
  let parsedData;
  let error;

  try {
    parsedData = JSON.parse(data);
  } catch (e) {
    // This is not JSON, probably an error message or plain string
    error = data;
  }

  // Handle SQL errors, which are NOT JSON
  if (error || typeof parsedData === "string") {
    return (
      <pre className="text-red-500 dark:text-red-400 whitespace-pre-wrap">
        {error || parsedData}
      </pre>
    );
  }

  // Handle empty results (e.g., from an INSERT or CREATE TABLE)
  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return (
      <span className="text-gray-500 dark:text-gray-400">
        Query executed successfully. No rows returned.
      </span>
    );
  }

  const headers = Object.keys(parsedData[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {parsedData.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {headers.map((header) => (
                <td
                  key={`${i}-${header}`}
                  className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                >
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SqlOutputTable;
