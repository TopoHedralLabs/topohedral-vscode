

def main():

    buffer = ''

    for i in range (1000):
        buffer += '//{{{\n'
        buffer += '    //{{{\n'
        buffer += '        //{{{\n'
        buffer += '        //}}}\n'
        buffer += '    //}}}\n'
        buffer += '//}}}\n'

    with open('big-file.txt', 'w') as f:
        f.write(buffer)


if __name__ == '__main__':
    main()  