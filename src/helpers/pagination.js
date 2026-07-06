const getPagination = (page = 1, limit = 10) => {
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const currentLimit = Number(limit) > 0 ? Number(limit) : 10;
  const offset = (currentPage - 1) * currentLimit;

  return {
    limit: currentLimit,
    offset,
    page: currentPage,
  };
};

module.exports = {
  getPagination,
};