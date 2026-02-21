export const getEmployee = () => {
  const employee = localStorage.getItem('employee');
  return employee ? JSON.parse(employee) : null;
};

export const setEmployee = (employee, token) => {
  localStorage.setItem('employee', JSON.stringify(employee));
  localStorage.setItem('token', token);
};

export const clearAuth = () => {
  localStorage.removeItem('employee');
  localStorage.removeItem('token');
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

