import api from './api';

export const courseService = {
  isDepartmentExist: (name: string) => api.get(`/admin/course/isDepartmentExist/${encodeURIComponent(name)}`),
  getAllDepartments: () => api.get('/admin/course/getAllDepartments'),
  getCourseStaticDetails: (courseId: string) =>
    api.get(`/admin/course/getCourseStaticDetails/${encodeURIComponent(courseId)}`),
  courseExists: (courseId: string) =>
    api.get(`/admin/course/courseExists/${encodeURIComponent(courseId)}`),
};
