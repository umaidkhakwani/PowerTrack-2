import React, { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Plus, Home, Activity } from "lucide-react";

interface Property {
  id: string;
  name: string;
  location: string;
}

export const Dashboard: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const { user, logout } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProp, setNewProp] = useState({ name: "", location: "" });

  const fetchProperties = async () => {
    try {
      const res = await api.get("/properties");
      setProperties(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/properties", newProp);
      setShowAddModal(false);
      setNewProp({ name: "", location: "" });
      fetchProperties();
    } catch {
      alert("Failed to add property");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Activity size={24} /> PowerTrack
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">Welcome, {user?.email}</span>
          <button onClick={logout} className="text-red-600 hover:text-red-800">
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Your Properties</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} /> Add Property
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => (
            <Link key={prop.id} to={`/property/${prop.id}`} className="block">
              <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {prop.name}
                    </h3>
                    <p className="text-gray-500 mt-1 flex items-center gap-1">
                      <Home size={16} /> {prop.location}
                    </p>
                  </div>
                  <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                    <Activity size={20} />
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {properties.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
              No properties found. Add one to get started!
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add New Property</h3>
            <form onSubmit={handleAddProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={newProp.name}
                  onChange={(e) =>
                    setNewProp({ ...newProp, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Location
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={newProp.location}
                  onChange={(e) =>
                    setNewProp({ ...newProp, location: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
