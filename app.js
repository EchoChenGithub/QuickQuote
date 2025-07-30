// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素引用
    const productListContainer = document.getElementById('product-list-container');
    const quoteTableBody = document.getElementById('quote-table-body');
    const totalPrice = document.getElementById('total-price');
    const totalPriceChinese = document.getElementById('total-price-chinese');
    const printBtn = document.getElementById('print-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const quoteDate = document.getElementById('quote-date');

    // 核心状态变量
    let allProducts = [];
    let selectedProducts = new Map();
    let quoteId = '';

    // 生成报价单编号
    function generateQuoteId() {
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const year = now.getFullYear();
        const month = pad(now.getMonth() + 1);
        const day = pad(now.getDate());
        const hour = pad(now.getHours());
        const min = pad(now.getMinutes());
        const sec = pad(now.getSeconds());
        return `BJ-${year}${month}${day}-${hour}${min}${sec}`;
    }

    // 初始化应用
    async function initializeApp() {
        // 设置当前日期
        const today = new Date().toISOString().split('T')[0];
        quoteDate.value = today;

        // 生成并显示报价单编号
        quoteId = generateQuoteId();
        const quoteIdSpan = document.getElementById('quote-id');
        if (quoteIdSpan) quoteIdSpan.textContent = quoteId;

        try {
            // 加载产品数据
            const response = await fetch('products.json');
            if (!response.ok) {
                throw new Error('无法加载产品数据');
            }
            allProducts = await response.json();

            // 渲染下拉选择
            renderCategoryAndProductSelect();

            // 设置事件监听器
            setupEventListeners();

        } catch (error) {
            console.error('初始化失败:', error);
            productListContainer.innerHTML = '<p style="color: red; padding: 20px;">加载产品数据失败，请检查网络连接或刷新页面。</p>';
        }
    }

    // 渲染分类和产品下拉框
    function renderCategoryAndProductSelect() {
        const categorySelect = document.getElementById('category-select');
        const productSelect = document.getElementById('product-select');
        if (!categorySelect || !productSelect) return;

        // 获取所有分类
        const categories = Array.from(new Set(allProducts.map(p => p.category)));
        categorySelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        // 渲染产品下拉（默认第一个分类）
        function renderProductOptions(selectedCategory) {
            const products = allProducts.filter(p => p.category === selectedCategory);
            productSelect.innerHTML = products.map(p => `<option value="${p.id}">${p.name} - ${p.spec}</option>`).join('');
        }
        renderProductOptions(categories[0]);

        // 分类联动
        categorySelect.onchange = function() {
            renderProductOptions(this.value);
        };
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 添加产品按钮
        const addBtn = document.getElementById('add-product-btn');
        const categorySelect = document.getElementById('category-select');
        const productSelect = document.getElementById('product-select');
        if (addBtn && productSelect) {
            addBtn.onclick = function() {
                const productId = productSelect.value;
                if (!productId) return;
                if (selectedProducts.has(productId)) {
                    alert('该产品已在报价单中');
                    return;
                }
                const product = allProducts.find(p => p.id === productId);
                if (product) {
                    selectedProducts.set(productId, { ...product, quantity: 1 });
                    renderQuoteTable();
                }
            };
        }
        // 数量变化事件
        quoteTableBody.addEventListener('input', handleQuantityChange);
        // 按钮事件
        printBtn.addEventListener('click', handlePrintClick);
        exportExcelBtn.addEventListener('click', exportToExcel);
    }

    // 打印按钮弹窗提示
    function handlePrintClick() {
        // 填充打印用纯文本
        document.getElementById('customer-name-print').textContent = document.getElementById('customer-name').value;
        document.getElementById('quote-unit-print').textContent = document.getElementById('quote-unit').options[document.getElementById('quote-unit').selectedIndex].text;
        document.getElementById('quote-date-print').textContent = document.getElementById('quote-date').value;
        alert('打印前请在浏览器打印设置中关闭“页眉和页脚”选项，以获得最佳打印效果。');
        window.print();
    }

    // 渲染报价单表格
    function renderQuoteTable() {
        quoteTableBody.innerHTML = '';
        
        let rowIndex = 1;
        selectedProducts.forEach((product, productId) => {
            const row = document.createElement('tr');
            const subtotal = (product.price * product.quantity).toFixed(2);
            
            row.innerHTML = `
                <td>${rowIndex}</td>
                <td><input type="text" class="editable-input name-input" data-product-id="${productId}" value="${product.name}" style="width:120px"></td>
                <td><input type="text" class="editable-input spec-input" data-product-id="${productId}" value="${product.spec}" style="width:100px"></td>
                <td><input type="text" class="editable-input unit-input" data-product-id="${productId}" value="${product.unit}" style="width:60px"></td>
                <td><input type="number" class="editable-input price-input" data-product-id="${productId}" value="${product.price}" min="0" step="0.01" style="width:80px"></td>
                <td>
                    <input type="number" 
                           class="quantity-input" 
                           value="${product.quantity}" 
                           min="1" 
                           data-product-id="${productId}">
                </td>
                <td class="subtotal-cell">¥${subtotal}</td>
                <td><input type="text" class="editable-input remarks-input" data-product-id="${productId}" value="${product.remarks || ''}" style="width:120px"></td>
            `;
            
            quoteTableBody.appendChild(row);
            rowIndex++;
        });
        
        updateTotal();
    }

    // 处理数量和可编辑字段变化
    quoteTableBody.addEventListener('input', function(e) {
        const productId = e.target.dataset.productId;
        if (!productId || !selectedProducts.has(productId)) return;
        const product = selectedProducts.get(productId);
        let needUpdateSubtotal = false;
        if (e.target.classList.contains('quantity-input')) {
            const newQuantity = parseInt(e.target.value) || 1;
            product.quantity = Math.max(1, newQuantity);
            needUpdateSubtotal = true;
        } else if (e.target.classList.contains('price-input')) {
            const newPrice = parseFloat(e.target.value) || 0;
            product.price = Math.max(0, newPrice);
            needUpdateSubtotal = true;
        } else if (e.target.classList.contains('unit-input')) {
            product.unit = e.target.value;
        } else if (e.target.classList.contains('spec-input')) {
            product.spec = e.target.value;
        } else if (e.target.classList.contains('name-input')) {
            product.name = e.target.value;
        } else if (e.target.classList.contains('remarks-input')) {
            product.remarks = e.target.value;
        }
        if (needUpdateSubtotal) {
            // 更新小计
            const row = e.target.closest('tr');
            const subtotalCell = row.querySelector('.subtotal-cell');
            const subtotal = (product.price * product.quantity).toFixed(2);
            subtotalCell.textContent = `¥${subtotal}`;
        }
        updateTotal();
    });

    // 处理数量变化
    function handleQuantityChange(e) {
        if (e.target.classList.contains('quantity-input')) {
            const productId = e.target.dataset.productId;
            const newQuantity = parseInt(e.target.value) || 1;
            
            if (selectedProducts.has(productId)) {
                const product = selectedProducts.get(productId);
                product.quantity = Math.max(1, newQuantity);
                
                // 更新小计
                const row = e.target.closest('tr');
                const subtotalCell = row.cells[6];
                const subtotal = (product.price * product.quantity).toFixed(2);
                subtotalCell.textContent = `¥${subtotal}`;
                
                updateTotal();
            }
        }
    }

    // 更新总计
    function updateTotal() {
        let total = 0;
        selectedProducts.forEach(product => {
            total += product.price * product.quantity;
        });
        
        totalPrice.textContent = `¥${total.toFixed(2)}`;
        totalPriceChinese.textContent = numberToChinese(total);
    }

    // 数字转中文大写
    function numberToChinese(n) {
        if (n === 0) return '零元整';
        
        const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
        const units = ['', '拾', '佰', '仟'];
        const bigUnits = ['', '万', '亿'];
        
        // 分离整数和小数部分
        const integerPart = Math.floor(n);
        const decimalPart = Math.round((n - integerPart) * 100);
        
        let result = '';
        
        // 处理整数部分
        if (integerPart > 0) {
            const intStr = integerPart.toString();
            const len = intStr.length;
            
            for (let i = 0; i < len; i++) {
                const digit = parseInt(intStr[i]);
                const position = len - 1 - i;
                const unitIndex = position % 4;
                const bigUnitIndex = Math.floor(position / 4);
                
                if (digit !== 0) {
                    result += digits[digit] + units[unitIndex];
                } else if (result.length > 0 && !result.endsWith('零')) {
                    result += '零';
                }
                
                // 添加大单位
                if (unitIndex === 0 && bigUnitIndex > 0 && 
                    (position === 0 || parseInt(intStr.substring(i - 3, i + 1)) !== 0)) {
                    result += bigUnits[bigUnitIndex];
                }
            }
            
            result += '元';
        }
        
        // 处理小数部分
        if (decimalPart > 0) {
            const jiao = Math.floor(decimalPart / 10);
            const fen = decimalPart % 10;
            
            if (jiao > 0) {
                result += digits[jiao] + '角';
            }
            if (fen > 0) {
                result += digits[fen] + '分';
            }
        } else {
            result += '整';
        }
        
        return result;
    }

    // 导出Excel
    function exportToExcel() {
        if (selectedProducts.size === 0) {
            alert('请先选择产品');
            return;
        }
        
        const customerName = document.getElementById('customer-name').value || '客户';
        const quoteUnit = document.getElementById('quote-unit').value || '';
        const date = quoteDate.value || new Date().toISOString().split('T')[0];
        
        // 准备数据
        const data = [
            ['报价单'],
            [''],
            ['报价单编号:', quoteId],
            ['客户名称:', customerName],
            ['报价单位:', quoteUnit],
            ['报价日期:', date],
            [''],
            ['序号', '商品名称', '规格', '单位', '单价 (元)', '数量', '小计 (元)', '备注']
        ];
        
        // 添加产品数据
        let rowIndex = 1;
        let total = 0;
        selectedProducts.forEach(product => {
            const subtotal = product.price * product.quantity;
            total += subtotal;
            
            data.push([
                rowIndex,
                product.name,
                product.spec,
                product.unit,
                product.price.toFixed(2),
                product.quantity,
                subtotal.toFixed(2),
                product.remarks || ''
            ]);
            rowIndex++;
        });
        
        // 添加总计行
        data.push(['']);
        data.push(['', '', '', '', '', '总计:', total.toFixed(2), '']);
        data.push(['', '', '', '', '', '总计金额（大写）:', numberToChinese(total), '']);
        
        // 创建工作表
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // 设置列宽
        ws['!cols'] = [
            { width: 8 },   // 序号
            { width: 20 },  // 商品名称
            { width: 15 },  // 规格
            { width: 8 },   // 单位
            { width: 12 },  // 单价
            { width: 8 },   // 数量
            { width: 12 },  // 小计
            { width: 20 }   // 备注
        ];
        
        // 设置单元格合并
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },  // 标题行
            { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },  // 空行
            { s: { r: 2, c: 1 }, e: { r: 2, c: 7 } },  // 编号
            { s: { r: 3, c: 1 }, e: { r: 3, c: 7 } },  // 客户名称
            { s: { r: 4, c: 1 }, e: { r: 4, c: 7 } },  // 报价单位
            { s: { r: 5, c: 1 }, e: { r: 5, c: 7 } },  // 报价日期
            { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } },  // 空行
            { s: { r: data.length - 2, c: 0 }, e: { r: data.length - 2, c: 4 } },  // 总计行
            { s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 4 } }   // 大写金额行
        ];
        
        // 应用样式格式
        applyExcelStyles(ws, data.length);
        
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '报价单');
        
        // 生成文件名
        const fileName = `报价单_${customerName}_${date}.xlsx`;
        
        // 下载文件
        XLSX.writeFile(wb, fileName);
    }

    // 应用Excel样式格式
    function applyExcelStyles(ws, totalRows) {
        // 定义样式
        const styles = {
            // 标题样式
            title: {
                font: { name: '微软雅黑', sz: 18, bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '4472C4' } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } }
                }
            },
            // 表头样式
            header: {
                font: { name: '微软雅黑', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '2F75B5' } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } }
                }
            },
            // 数据行样式
            data: {
                font: { name: '微软雅黑', sz: 11 },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                }
            },
            // 客户信息样式
            customerInfo: {
                font: { name: '微软雅黑', sz: 11, bold: true },
                alignment: { horizontal: 'left', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                }
            },
            // 总计样式
            total: {
                font: { name: '微软雅黑', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: 'E74C3C' } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } }
                }
            },
            // 金额列样式
            money: {
                font: { name: '微软雅黑', sz: 11 },
                alignment: { horizontal: 'right', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                }
            }
        };

        // 应用标题样式 (A1:H1)
        for (let col = 0; col < 8; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].s = styles.title;
        }

        // 应用客户信息样式 (A3:A4)
        for (let row = 2; row <= 3; row++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].s = styles.customerInfo;
        }

        // 应用表头样式 (A6:H6)
        for (let col = 0; col < 8; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 5, c: col });
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].s = styles.header;
        }

        // 应用数据行样式
        for (let row = 6; row < totalRows - 3; row++) {
            for (let col = 0; col < 8; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                if (!ws[cellRef]) continue;
                
                // 序号列居中
                if (col === 0) {
                    ws[cellRef].s = styles.data;
                }
                // 商品名称和规格左对齐
                else if (col === 1 || col === 2) {
                    ws[cellRef].s = { ...styles.data, alignment: { horizontal: 'left', vertical: 'center' } };
                }
                // 金额列右对齐
                else if (col === 4 || col === 6) {
                    ws[cellRef].s = styles.money;
                }
                // 其他列居中
                else {
                    ws[cellRef].s = styles.data;
                }
            }
        }

        // 应用总计行样式
        const totalRow = totalRows - 2;
        const chineseRow = totalRows - 1;
        
        // 总计行
        for (let col = 0; col < 8; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: totalRow, c: col });
            if (!ws[cellRef]) continue;
            
            if (col === 5) { // "总计:" 标签
                ws[cellRef].s = { ...styles.total, alignment: { horizontal: 'right', vertical: 'center' } };
            } else if (col === 6) { // 总计金额
                ws[cellRef].s = { ...styles.total, alignment: { horizontal: 'right', vertical: 'center' } };
            } else {
                ws[cellRef].s = styles.total;
            }
        }

        // 中文金额行
        for (let col = 0; col < 8; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: chineseRow, c: col });
            if (!ws[cellRef]) continue;
            
            if (col === 5) { // "总计金额（大写）:" 标签
                ws[cellRef].s = { ...styles.total, alignment: { horizontal: 'right', vertical: 'center' } };
            } else if (col === 6) { // 中文金额
                ws[cellRef].s = { ...styles.total, alignment: { horizontal: 'left', vertical: 'center' } };
            } else {
                ws[cellRef].s = styles.total;
            }
        }

        // 设置行高
        ws['!rows'] = [];
        for (let i = 0; i < totalRows; i++) {
            if (i === 0) {
                ws['!rows'][i] = { hpt: 30 }; // 标题行高度
            } else if (i === 5) {
                ws['!rows'][i] = { hpt: 25 }; // 表头行高度
            } else {
                ws['!rows'][i] = { hpt: 20 }; // 数据行高度
            }
        }
    }

    // 启动应用
    initializeApp();
}); 