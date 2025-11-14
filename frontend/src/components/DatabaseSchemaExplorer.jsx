import React from "react";
import { FaTable, FaKey, FaColumns } from "react-icons/fa";

// Hardcoded schema based on the init.sql script
const schema = {
  Customers: [
    { name: "customer_id", type: "INT", isKey: true },
    { name: "first_name", type: "VARCHAR(100)" },
    { name: "last_name", type: "VARCHAR(100)" },
    { name: "age", type: "INT" },
    { name: "country", type: "VARCHAR(100)" },
  ],
  Orders: [
    { name: "order_id", type: "INT", isKey: true },
    { name: "item", type: "VARCHAR(100)" },
    { name: "amount", type: "INT" },
    { name: "customer_id", type: "INT" },
  ],
  Shippings: [
    { name: "shipping_id", type: "INT", isKey: true },
    { name: "status", type: "VARCHAR(100)" },
    { name: "customer_id", type: "INT" },
  ],
};

const DatabaseSchemaExplorer = () => {
  return (
    <div className="h-full flex flex-col text-sm text-gray-800 dark:text-gray-300">
      <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Database Schema
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          mydatabase.db
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(schema).map(([tableName, columns]) => (
          <div key={tableName} className="mb-4">
            <div className="flex items-center gap-2 mb-1 p-1 rounded">
              <FaTable className="text-blue-500" />
              <span className="font-medium">{tableName}</span>
            </div>
            <ul className="ml-4 pl-2 border-l border-gray-200 dark:border-gray-700">
              {columns.map((col) => (
                <li
                  key={col.name}
                  className="flex items-center gap-2 p-1 text-xs"
                >
                  {col.isKey ? (
                    <FaKey className="text-yellow-500" />
                  ) : (
                    <FaColumns className="text-gray-400" />
                  )}
                  <span>{col.name}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    ({col.type})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DatabaseSchemaExplorer;