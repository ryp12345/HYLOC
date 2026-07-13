import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import { getDepartments } from '../../api/departmentApi';
import { getDesignations } from '../../api/designationApi';
import { getUserById } from '../../api/userApi';
import { API_URL } from '../../api/axios';
import Notification from '../../components/common/Notification';

// Resolve a stored upload path (e.g. /api/uploads/users/EMP001.jpg) to an absolute URL
const getPhotoUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/api/uploads/') || path.startsWith('/uploads/')) {
    try {
      const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
      return `${appOrigin}${path}`;
    } catch {
      return path;
    }
  }
  try {
    const appOrigin = API_URL.startsWith('http') ? new URL(API_URL).origin : window.location.origin;
    return `${appOrigin}/api/uploads/users/${String(path).replace(/^\/+/, '')}`;
  } catch {
    return path;
  }
};

const getPhotoCandidates = (staffPhoto, empid) => {
  const candidates = [];
  const addCandidate = (value) => {
    const url = getPhotoUrl(value);
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  addCandidate(staffPhoto);

  if (empid) {
    const normalizedEmpid = String(empid).trim();
    addCandidate(`/api/uploads/users/${normalizedEmpid}`);
    ['jpg', 'jpeg', 'png', 'webp', 'gif'].forEach((ext) => {
      addCandidate(`/api/uploads/users/${normalizedEmpid}.${ext}`);
    });
  }

  return candidates;
};

export default function ProfilePage() {
  const { user: authUser, updateUserContext } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(true);
  const [userData, setUserData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoCandidates, setPhotoCandidates] = useState([]);
  
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    empid: '',
    phone: '',
    address: '',
    bloodGroup: '',
    departmentId: '',
    designationId: '',
  });

  useEffect(() => {
    loadProfile();
    loadDepartments();
    loadDesignations();
    // Fetch department and designation from user table
    if (authUser?.id) {
      fetchUserDepartmentDesignation(authUser.id);
    }
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/users/me');
      const data = response.data.data;
      setUserData(data);
      const candidates = getPhotoCandidates(data.staff_photo_url || data.staff_photo, data.empid);
      setPhotoCandidates(candidates);
      setPhotoPreview(candidates[0] || '');
      setForm({
        firstName: data.firstname || '',
        middleName: data.middlename || '',
        lastName: data.lastname || '',
        email: data.email || '',
        empid: data.empid || '',
        phone: data.phone || '',
        address: data.address || '',
        bloodGroup: data.bloodgroup || '',
        departmentId: data.department_id || '',
        designationId: data.designation_id || '',
      });
    } catch (error) {
      setNotification({
        show: true,
        message: 'Failed to load profile',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch department and designation from user table (by user id)
  const [userDeptDesig, setUserDeptDesig] = useState({ department: '', designation: '' });
  const fetchUserDepartmentDesignation = async (userId) => {
    try {
      const res = await getUserById(userId);
      const user = res.data?.data;
      setUserDeptDesig({
        department: user?.department_id || '',
        designation: user?.designation_id || ''
      });
    } catch (err) {
      setUserDeptDesig({ department: '', designation: '' });
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await getDepartments();
      setDepartments(res.data?.data || []);
    } catch (error) {
      console.error('Failed to load departments');
    }
  };

  const loadDesignations = async () => {
    try {
      const res = await getDesignations();
      setDesignations(res.data?.data || []);
    } catch (error) {
      console.error('Failed to load designations');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.firstName || !form.lastName || !form.email) {
      setNotification({
        show: true,
        message: 'First name, last name, and email are required',
        type: 'error'
      });
      return;
    }

    try {
      const updateData = {
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        bloodGroup: form.bloodGroup,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
      };

      // Use multipart/form-data when a new photo file is selected
      let requestData = updateData;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(updateData).forEach(([key, value]) => {
          if (value !== null && value !== undefined) fd.append(key, value);
        });
        if (form.empid) fd.append('empid', form.empid);
        fd.append('staffPhoto', photoFile);
        requestData = fd;
      }

      // Use /users/me endpoint for self-update
      await axios.put('/users/me', requestData,
        photoFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
      );
      
      // Update auth context if name changed
      if (updateUserContext) {
        updateUserContext({
          ...authUser,
          firstName: form.firstName,
          lastName: form.lastName,
        });
      }

      setNotification({
        show: true,
        message: 'Profile updated successfully!',
        type: 'success'
      });
      // Keep the form in edit mode after save so Save/Cancel remain visible
      loadProfile();
    } catch (error) {
      setNotification({
        show: true,
        message: error.response?.data?.message || 'Failed to update profile',
        type: 'error'
      });
    }
  };

  const getDepartmentName = (id) => {
    const dept = departments.find(d => d.id === id);
    return dept ? dept.department_name : 'N/A';
  };

  const getDesignationName = (id) => {
    const desig = designations.find(d => d.id === id);
    return desig ? desig.designation_name : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-blue-600 text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ show: false, message: '', type: '' })}
      />
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full bg-white text-blue-600 flex items-center justify-center text-3xl font-bold shadow-lg overflow-hidden">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={() => {
                    setPhotoCandidates((current) => {
                      const next = current.slice(1);
                      setPhotoPreview(next[0] || '');
                      return next;
                    });
                  }}
                />
              ) : (
                (userData?.firstname?.[0] || 'U').toUpperCase()
              )}
            </div>
            <div className="text-white">
              <h1 className="text-3xl font-bold">
                {userData?.firstname} {userData?.middlename} {userData?.lastname}
              </h1>
              <p className="text-blue-100 mt-1">Employee ID: {userData?.empid || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Profile Information</h2>
          </div>

          {isEditing ? (
            /* Edit Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={form.middleName}
                    onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={form.empid}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blood Group
                  </label>
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Photo
                </label>
                {photoPreview && (
                  <img src={photoPreview} alt="Profile preview" className="object-cover w-16 h-16 mb-2 rounded-full border border-gray-300" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPhotoFile(file);
                    setPhotoPreview(file ? URL.createObjectURL(file) : getPhotoUrl(userData?.staff_photo));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    value={form.departmentId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    disabled
                  >
                    <option value="">Select Department</option>
                    {/* Always show selected department if not in list */}
                    {(
                      form.departmentId &&
                      !departments.some(dept => String(dept.id) === String(form.departmentId)) &&
                      userData?.department_id &&
                      (
                        <option key={userData.department_id} value={userData.department_id}>
                          {getDepartmentName(userData.department_id)}
                        </option>
                      )
                    )}
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Designation
                  </label>
                  <select
                    value={form.designationId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    disabled
                  >
                    <option value="">Select Designation</option>
                    {/* Always show selected designation if not in list */}
                    {(
                      form.designationId &&
                      !designations.some(desig => String(desig.id) === String(form.designationId)) &&
                      userData?.designation_id &&
                      (
                        <option key={userData.designation_id} value={userData.designation_id}>
                          {getDesignationName(userData.designation_id)}
                        </option>
                      )
                    )}
                    {designations.map(desig => (
                      <option key={desig.id} value={desig.id}>{desig.designation_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    loadProfile();
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Full Name</label>
                  <p className="mt-1 text-lg text-gray-900">
                    {userData?.firstname} {userData?.middlename} {userData?.lastname}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Email</label>
                  <p className="mt-1 text-lg text-gray-900">{userData?.email || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Employee ID</label>
                  <p className="mt-1 text-lg text-gray-900">{userData?.empid || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Phone</label>
                  <p className="mt-1 text-lg text-gray-900">{userData?.phone || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Blood Group</label>
                  <p className="mt-1 text-lg text-gray-900">{userData?.bloodgroup || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Department</label>
                  <p className="mt-1 text-lg text-gray-900">
                    {userDeptDesig.department
                      ? getDepartmentName(userDeptDesig.department)
                      : getDepartmentName(userData?.department_id)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Designation</label>
                  <p className="mt-1 text-lg text-gray-900">
                    {userDeptDesig.designation
                      ? getDesignationName(userDeptDesig.designation)
                      : getDesignationName(userData?.designation_id)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Status</label>
                  <p className="mt-1">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      userData?.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {userData?.status || 'N/A'}
                    </span>
                  </p>
                </div>
              </div>

              {userData?.address && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="text-sm font-semibold text-gray-600 uppercase">Address</label>
                  <p className="mt-1 text-lg text-gray-900">{userData.address}</p>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label className="text-sm font-semibold text-gray-600 uppercase">Account Created</label>
                <p className="mt-1 text-lg text-gray-900">
                  {userData?.created_at ? new Date(userData.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-6">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
